import {
  PermissionScopeType,
  PolicyEffect,
  PolicyTarget,
  PrismaClient,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const GOVERNANCE_PERMISSIONS = [
  {
    key: "admin.requests.view",
    description: "View governed change requests"
  },
  {
    key: "admin.requests.create.schedule_change",
    description: "Create schedule change requests"
  },
  {
    key: "admin.requests.create.room_booking",
    description: "Create room booking requests"
  },
  {
    key: "admin.requests.submit",
    description: "Submit draft requests for review"
  },
  {
    key: "admin.approvals.view",
    description: "View approval queue and history"
  },
  {
    key: "admin.approvals.decide",
    description: "Approve or reject pending approval steps"
  },
  {
    key: "admin.policies.view",
    description: "View governance policies"
  },
  {
    key: "admin.policies.manage",
    description: "Create, simulate and activate governance policies"
  }
] as const;

const ROLE_PERMISSION_KEYS: Record<UserRole, string[]> = {
  [UserRole.admin]: GOVERNANCE_PERMISSIONS.map((item) => item.key),
  [UserRole.staff]: [
    "admin.requests.view",
    "admin.requests.create.schedule_change",
    "admin.requests.create.room_booking",
    "admin.requests.submit"
  ],
  [UserRole.viewer]: []
};

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin12345", 10);
  const staffPasswordHash = await bcrypt.hash("staff12345", 10);
  const viewerPasswordHash = await bcrypt.hash("viewer12345", 10);

  const admin = await prisma.user.upsert({
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

  const staff = await prisma.user.upsert({
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

  const viewer = await prisma.user.upsert({
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

  const permissions = await Promise.all(
    GOVERNANCE_PERMISSIONS.map((item) =>
      prisma.permission.upsert({
        where: { key: item.key },
        update: {
          description: item.description
        },
        create: {
          key: item.key,
          description: item.description
        }
      })
    )
  );

  const permissionByKey = new Map(permissions.map((item) => [item.key, item.id]));

  await prisma.$transaction(async (tx) => {
    for (const role of Object.values(UserRole)) {
      await tx.rolePermission.deleteMany({
        where: { role }
      });

      const keys = ROLE_PERMISSION_KEYS[role] ?? [];
      if (keys.length > 0) {
        await tx.rolePermission.createMany({
          data: keys
            .map((key) => permissionByKey.get(key))
            .filter((permissionId): permissionId is string => Boolean(permissionId))
            .map((permissionId) => ({
              role,
              permissionId
            })),
          skipDuplicates: true
        });
      }
    }
  });

  await prisma.userScope.deleteMany({
    where: {
      userId: {
        in: [admin.id, staff.id, viewer.id]
      }
    }
  });

  await prisma.userScope.createMany({
    data: [
      {
        userId: admin.id,
        scopeType: PermissionScopeType.request,
        scopeValue: "all"
      },
      {
        userId: admin.id,
        scopeType: PermissionScopeType.approval,
        scopeValue: "all"
      },
      {
        userId: admin.id,
        scopeType: PermissionScopeType.policy,
        scopeValue: "all"
      },
      {
        userId: staff.id,
        scopeType: PermissionScopeType.request,
        scopeValue: "own"
      },
      {
        userId: staff.id,
        scopeType: PermissionScopeType.approval,
        scopeValue: "assigned"
      },
      {
        userId: viewer.id,
        scopeType: PermissionScopeType.request,
        scopeValue: "own"
      }
    ],
    skipDuplicates: true
  });

  await Promise.all([
    prisma.policyRule.upsert({
      where: { name: "deny_high_risk_submission" },
      update: {
        description: "Block submissions with risk score above threshold",
        target: PolicyTarget.request_submit,
        effect: PolicyEffect.deny,
        conditionsJson: {
          maxRiskScore: 70
        },
        enabled: true,
        active: true,
        priority: 10,
        createdById: admin.id
      },
      create: {
        name: "deny_high_risk_submission",
        description: "Block submissions with risk score above threshold",
        target: PolicyTarget.request_submit,
        effect: PolicyEffect.deny,
        conditionsJson: {
          maxRiskScore: 70
        },
        enabled: true,
        active: true,
        priority: 10,
        createdById: admin.id
      }
    }),
    prisma.policyRule.upsert({
      where: { name: "deny_blocking_conflicts" },
      update: {
        description: "Block requests that contain blocking conflicts",
        target: PolicyTarget.request_submit,
        effect: PolicyEffect.deny,
        conditionsJson: {
          maxBlockingIssues: 0
        },
        enabled: true,
        active: true,
        priority: 20,
        createdById: admin.id
      },
      create: {
        name: "deny_blocking_conflicts",
        description: "Block requests that contain blocking conflicts",
        target: PolicyTarget.request_submit,
        effect: PolicyEffect.deny,
        conditionsJson: {
          maxBlockingIssues: 0
        },
        enabled: true,
        active: true,
        priority: 20,
        createdById: admin.id
      }
    }),
    prisma.policyRule.upsert({
      where: { name: "approval_admin_only" },
      update: {
        description: "Allow approval decisions only by admins",
        target: PolicyTarget.approval_decide,
        effect: PolicyEffect.deny,
        conditionsJson: {
          allowedRoles: ["admin"]
        },
        enabled: true,
        active: true,
        priority: 30,
        createdById: admin.id
      },
      create: {
        name: "approval_admin_only",
        description: "Allow approval decisions only by admins",
        target: PolicyTarget.approval_decide,
        effect: PolicyEffect.deny,
        conditionsJson: {
          allowedRoles: ["admin"]
        },
        enabled: true,
        active: true,
        priority: 30,
        createdById: admin.id
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
