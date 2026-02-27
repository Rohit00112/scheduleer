import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PolicyEffect, PolicyTarget, Prisma } from "@prisma/client";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { GovernanceAuthzService } from "./governance-authz.service";
import { GOVERNANCE_PERMISSIONS } from "./governance.constants";
import { PolicyEngineService } from "./policy-engine.service";
import { CreatePolicyRuleDto } from "./dto/create-policy-rule.dto";
import { SimulatePolicyDto } from "./dto/simulate-policy.dto";

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authzService: GovernanceAuthzService,
    private readonly policyEngineService: PolicyEngineService
  ) {}

  async list(user: AuthUser) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.POLICIES_VIEW);

    const visibilityWhere = await this.authzService.policyVisibilityWhere(user.id);

    return this.prismaService.policyRule.findMany({
      where: visibilityWhere,
      orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
            role: true
          }
        },
        _count: {
          select: {
            evaluations: true
          }
        }
      }
    });
  }

  async create(user: AuthUser, payload: CreatePolicyRuleDto) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.POLICIES_MANAGE);

    const policy = await this.prismaService.policyRule.create({
      data: {
        name: payload.name,
        description: payload.description ?? null,
        target: (payload.target ?? PolicyTarget.request_submit) as PolicyTarget,
        effect: (payload.effect ?? PolicyEffect.deny) as PolicyEffect,
        conditionsJson: (payload.conditionsJson ?? {}) as Prisma.InputJsonValue,
        enabled: payload.enabled ?? true,
        active: payload.active ?? false,
        priority: payload.priority ?? 100,
        createdById: user.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
            role: true
          }
        }
      }
    });

    await this.prismaService.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "policy_created",
        targetType: "policy_rule",
        targetId: policy.id,
        metaJson: {
          name: policy.name,
          target: policy.target,
          active: policy.active
        }
      }
    });

    return policy;
  }

  async simulate(user: AuthUser, policyId: string, payload: SimulatePolicyDto) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.POLICIES_MANAGE);

    const policy = await this.prismaService.policyRule.findUnique({
      where: { id: policyId }
    });

    if (!policy) {
      throw new NotFoundException("Policy not found");
    }

    const target = (payload.target ?? policy.target) as PolicyTarget;
    if (target !== policy.target) {
      throw new BadRequestException("Simulation target must match policy target");
    }

    const result = await this.policyEngineService.evaluate({
      target,
      actorUserId: user.id,
      actorRole: payload.actorRole ?? user.role,
      request: {
        type: payload.requestType ?? "schedule_change"
      },
      impact: {
        riskScore: payload.riskScore ?? 0,
        blockingIssues: payload.blockingIssues ?? 0,
        warningIssues: payload.warningIssues ?? 0
      },
      context: payload.context,
      policies: [policy]
    });

    return {
      policyId: policy.id,
      policyName: policy.name,
      target,
      allowed: result.allowed,
      reasons: result.reasons,
      decisions: result.decisions
    };
  }

  async activate(user: AuthUser, policyId: string) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.POLICIES_MANAGE);

    const exists = await this.prismaService.policyRule.findUnique({ where: { id: policyId } });
    if (!exists) {
      throw new NotFoundException("Policy not found");
    }

    const updated = await this.prismaService.policyRule.update({
      where: { id: policyId },
      data: {
        active: true,
        enabled: true
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
            role: true
          }
        }
      }
    });

    await this.prismaService.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "policy_activated",
        targetType: "policy_rule",
        targetId: policyId,
        metaJson: {
          target: updated.target,
          priority: updated.priority
        }
      }
    });

    return updated;
  }
}
