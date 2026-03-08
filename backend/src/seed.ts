import { DataSource } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { User, UserRole } from './entities/user.entity';
import { join } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import * as bcrypt from 'bcrypt';

async function seed() {
    const dbDir = join(__dirname, '..', 'data');
    mkdirSync(dbDir, { recursive: true });

    const ds = new DataSource({
        type: 'sqlite',
        database: join(dbDir, 'scheduler.db'),
        entities: [Schedule, User],
        synchronize: true,
    });

    await ds.initialize();

    // Seed schedules
    const scheduleRepo = ds.getRepository(Schedule);
    const count = await scheduleRepo.count();
    if (count > 0) {
        console.log(`Database already has ${count} records. Clearing...`);
        await scheduleRepo.clear();
    }

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

    // Seed users
    const userRepo = ds.getRepository(User);
    const userCount = await userRepo.count();
    if (userCount === 0) {
        const adminPassword = await bcrypt.hash('admin123', 10);
        const userPassword = await bcrypt.hash('user123', 10);

        await userRepo.save([
            { username: 'admin', password: adminPassword, role: UserRole.ADMIN },
            { username: 'user', password: userPassword, role: UserRole.USER },
        ]);
        console.log('Seeded default users: admin/admin123, user/user123');
    } else {
        console.log(`Users table already has ${userCount} records. Skipping.`);
    }

    await ds.destroy();
}

seed().catch(console.error);
