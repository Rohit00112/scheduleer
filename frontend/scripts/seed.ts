import { hash } from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDataSource } from "../lib/server/db";
import { Schedule, User, UserRole } from "../lib/server/entities";
import { generateUsername } from "../lib/server/services/auth-users";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  const dataSource = await getDataSource();
  const scheduleRepo = dataSource.getRepository(Schedule);
  const userRepo = dataSource.getRepository(User);

  const scheduleCount = await scheduleRepo.count();
  if (scheduleCount === 0) {
    const seedData = JSON.parse(
      readFileSync(path.join(__dirname, "seed-data.json"), "utf8"),
    ) as Array<Partial<Schedule>>;

    const batchSize = 50;
    let total = 0;
    for (let index = 0; index < seedData.length; index += batchSize) {
      const batch = seedData.slice(index, index + batchSize);
      await scheduleRepo.save(batch as Schedule[]);
      total += batch.length;
    }

    console.log(`Seeded ${total} schedule records.`);
  } else {
    console.log(`Database already has ${scheduleCount} schedule records. Skipping seed.`);
  }

  const userCount = await userRepo.count();
  if (userCount === 0) {
    const adminPassword = await hash("admin123", 10);
    const userPassword = await hash("user123", 10);

    await userRepo.save([
      {
        username: "admin",
        password: adminPassword,
        role: UserRole.ADMIN,
        mustChangePassword: false,
        instructorName: null,
      },
      {
        username: "user",
        password: userPassword,
        role: UserRole.USER,
        mustChangePassword: false,
        instructorName: null,
      },
    ]);

    console.log("Seeded default users: admin/admin123, user/user123");
  } else {
    console.log(`Users table already has ${userCount} records. Skipping default users.`);
  }

  const allSchedules = await scheduleRepo.find();
  const instructorNames = new Set<string>();
  for (const schedule of allSchedules) {
    if (schedule.instructor && schedule.instructor.trim()) {
      instructorNames.add(schedule.instructor.trim());
    }
  }

  const defaultPassword = await hash("instructor123", 10);
  let instructorCount = 0;
  for (const name of instructorNames) {
    const username = generateUsername(name);
    const existing = await userRepo.findOne({ where: { username } });
    if (existing) {
      continue;
    }

    await userRepo.save({
      username,
      password: defaultPassword,
      role: UserRole.INSTRUCTOR,
      mustChangePassword: true,
      instructorName: name,
    });
    instructorCount += 1;
  }

  if (instructorCount > 0) {
    console.log(
      `Created ${instructorCount} instructor users (password: instructor123, must change on first login)`,
    );
  } else {
    console.log("Instructor users already exist. Skipping.");
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
