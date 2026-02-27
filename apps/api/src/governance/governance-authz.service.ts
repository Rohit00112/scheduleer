import { ForbiddenException, Injectable } from "@nestjs/common";
import { PermissionScopeType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GOVERNANCE_SCOPE } from "./governance.constants";

@Injectable()
export class GovernanceAuthzService {
  constructor(private readonly prismaService: PrismaService) {}

  async requirePermissions(userId: string, permissions: string | string[]): Promise<void> {
    const keys = Array.isArray(permissions) ? permissions : [permissions];
    const uniqueKeys = Array.from(new Set(keys));

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        active: true
      }
    });

    if (!user || !user.active) {
      throw new ForbiddenException("User is inactive or missing");
    }

    const matchedCount = await this.prismaService.rolePermission.count({
      where: {
        role: user.role,
        permission: {
          key: {
            in: uniqueKeys
          }
        }
      }
    });

    if (matchedCount < uniqueKeys.length) {
      throw new ForbiddenException("Missing required permission");
    }
  }

  async isScopeAll(userId: string, scopeType: PermissionScopeType): Promise<boolean> {
    const count = await this.prismaService.userScope.count({
      where: {
        userId,
        scopeType,
        scopeValue: GOVERNANCE_SCOPE.ALL
      }
    });

    return count > 0;
  }

  async requestVisibilityWhere(userId: string): Promise<Prisma.ChangeRequestWhereInput> {
    if (await this.isScopeAll(userId, PermissionScopeType.request)) {
      return {};
    }

    const scoped = await this.prismaService.userScope.findMany({
      where: {
        userId,
        scopeType: PermissionScopeType.request
      },
      select: {
        scopeValue: true
      }
    });

    const values = new Set(scoped.map((item) => item.scopeValue));
    if (values.has(GOVERNANCE_SCOPE.OWN)) {
      return {
        OR: [{ requestedById: userId }, { submittedById: userId }]
      };
    }

    return {
      requestedById: userId
    };
  }

  async approvalVisibilityWhere(userId: string): Promise<Prisma.ApprovalStepWhereInput> {
    if (await this.isScopeAll(userId, PermissionScopeType.approval)) {
      return {};
    }

    const scoped = await this.prismaService.userScope.findMany({
      where: {
        userId,
        scopeType: PermissionScopeType.approval
      },
      select: {
        scopeValue: true
      }
    });

    const values = new Set(scoped.map((item) => item.scopeValue));
    if (values.has(GOVERNANCE_SCOPE.ASSIGNED)) {
      return {
        approverUserId: userId
      };
    }

    return {
      approverUserId: userId
    };
  }

  async policyVisibilityWhere(userId: string): Promise<Prisma.PolicyRuleWhereInput> {
    if (await this.isScopeAll(userId, PermissionScopeType.policy)) {
      return {};
    }

    return {
      OR: [{ active: true }, { createdById: userId }]
    };
  }
}
