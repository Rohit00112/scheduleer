const { PrismaClient, UserRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin12345", 10);
  const staffPasswordHash = await bcrypt.hash("staff12345", 10);
  const viewerPasswordHash = await bcrypt.hash("viewer12345", 10);

  await prisma.user.upsert({
    where: { email: "admin@schedule.local" },
    update: {
      displayName: "Admin",
      role: UserRole.admin,
      active: true,
      preferredWorkspace: "admin",
      timezone: "Asia/Kathmandu",
      passwordHash: adminPasswordHash
    },
    create: {
      email: "admin@schedule.local",
      displayName: "Admin",
      role: UserRole.admin,
      active: true,
      preferredWorkspace: "admin",
      timezone: "Asia/Kathmandu",
      lecturerAliases: [],
      passwordHash: adminPasswordHash
    }
  });

  await prisma.user.upsert({
    where: { email: "staff@schedule.local" },
    update: {
      displayName: "Staff User",
      role: UserRole.staff,
      active: true,
      preferredWorkspace: "portal",
      timezone: "Asia/Kathmandu",
      lecturerAliases: ["Staff User"],
      passwordHash: staffPasswordHash
    },
    create: {
      email: "staff@schedule.local",
      displayName: "Staff User",
      role: UserRole.staff,
      active: true,
      preferredWorkspace: "portal",
      timezone: "Asia/Kathmandu",
      lecturerAliases: ["Staff User"],
      passwordHash: staffPasswordHash
    }
  });

  await prisma.user.upsert({
    where: { email: "viewer@schedule.local" },
    update: {
      displayName: "Viewer User",
      role: UserRole.viewer,
      active: true,
      preferredWorkspace: "portal",
      timezone: "Asia/Kathmandu",
      lecturerAliases: ["Viewer User"],
      passwordHash: viewerPasswordHash
    },
    create: {
      email: "viewer@schedule.local",
      displayName: "Viewer User",
      role: UserRole.viewer,
      active: true,
      preferredWorkspace: "portal",
      timezone: "Asia/Kathmandu",
      lecturerAliases: ["Viewer User"],
      passwordHash: viewerPasswordHash
    }
  });

  await prisma.scheduleTerm.upsert({
    where: { name: "Spring 2026" },
    update: { timezone: "Asia/Kathmandu" },
    create: {
      name: "Spring 2026",
      timezone: "Asia/Kathmandu"
    }
  });

  await Promise.all([
    prisma.alertRule.upsert({
      where: { name: "schedule_activation" },
      update: {},
      create: {
        name: "schedule_activation",
        triggerType: "schedule_activation",
        enabled: true,
        channelInApp: true,
        channelEmail: false,
        configJson: {
          includeRoles: ["admin", "staff", "viewer"]
        }
      }
    }),
    prisma.alertRule.upsert({
      where: { name: "schedule_change" },
      update: {},
      create: {
        name: "schedule_change",
        triggerType: "schedule_change",
        enabled: true,
        channelInApp: true,
        channelEmail: false,
        configJson: {
          includeRoles: ["staff", "viewer"]
        }
      }
    }),
    prisma.alertRule.upsert({
      where: { name: "class_reminder" },
      update: {},
      create: {
        name: "class_reminder",
        triggerType: "class_reminder",
        enabled: false,
        channelInApp: true,
        channelEmail: false,
        configJson: {
          leadMinutes: 30
        }
      }
    })
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
