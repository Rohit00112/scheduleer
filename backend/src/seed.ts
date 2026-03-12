import { DataSource } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { User, UserRole } from './entities/user.entity';
import { join } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import * as bcrypt from 'bcrypt';

function generateUsername(instructorName: string): string {
    // "Mr. Binaya Koirala" → "binaya.koirala"
    return instructorName
        .replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.');
}

function getDataSourceConfig(): any {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        return {
            type: 'postgres',
            url: dbUrl,
            entities: [Schedule, User],
            synchronize: true,
            ssl: dbUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined,
        };
    }
    const dbDir = join(__dirname, '..', 'data');
    mkdirSync(dbDir, { recursive: true });
    return {
        type: 'sqlite',
        database: join(dbDir, 'scheduler.db'),
        entities: [Schedule, User],
        synchronize: true,
    };
}

async function seed() {
    const ds = new DataSource(getDataSourceConfig());

    await ds.initialize();

    // Seed schedules only if empty
    const scheduleRepo = ds.getRepository(Schedule);
    const count = await scheduleRepo.count();
    if (count > 0) {
        console.log(`Database already has ${count} schedule records. Skipping seed.`);
    } else {

        const seedData: any[] = JSON.parse(
            readFileSync(join(__dirname, 'seed-data.json'), 'utf-8'),
        );
        const batchSize = 50;
        let total = 0;
        for (let i = 0; i < seedData.length; i += batchSize) {
            const batch = seedData.slice(i, i + batchSize);
            await scheduleRepo.save(batch as any);
            total += batch.length;
        }
        console.log(`Seeded ${total} schedule records.`);
    }

    // Seed users
    const userRepo = ds.getRepository(User);
    const userCount = await userRepo.count();
    if (userCount === 0) {
        const adminPassword = await bcrypt.hash('admin123', 10);
        const userPassword = await bcrypt.hash('user123', 10);

        await userRepo.save([
            { username: 'admin', password: adminPassword, role: UserRole.ADMIN, mustChangePassword: false, instructorName: null },
            { username: 'user', password: userPassword, role: UserRole.USER, mustChangePassword: false, instructorName: null },
        ]);
        console.log('Seeded default users: admin/admin123, user/user123');
    } else {
        console.log(`Users table already has ${userCount} records. Skipping default users.`);
    }

    // Seed instructor users from schedules
    const allSchedules = await scheduleRepo.find();
    const instructorNames = new Set<string>();
    for (const s of allSchedules) {
        if (s.instructor && s.instructor.trim()) {
            instructorNames.add(s.instructor.trim());
        }
    }

    const defaultPassword = await bcrypt.hash('instructor123', 10);
    let instructorCount = 0;

    for (const name of instructorNames) {
        const username = generateUsername(name);
        const existing = await userRepo.findOne({ where: { username } });
        if (!existing) {
            await userRepo.save({
                username,
                password: defaultPassword,
                role: UserRole.INSTRUCTOR,
                mustChangePassword: true,
                instructorName: name,
            });
            instructorCount++;
        }
    }

    if (instructorCount > 0) {
        console.log(`Created ${instructorCount} instructor users (password: instructor123, must change on first login)`);
    } else {
        console.log('Instructor users already exist. Skipping.');
    }

    await ds.destroy();
}

seed().catch(console.error);
