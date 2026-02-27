import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import {
  ApprovalFlowStatus,
  ApprovalStepStatus,
  ChangeRequestStatus,
  PermissionScopeType,
  Prisma
} from "@prisma/client";
import { Queue } from "bullmq";
import { APPROVAL_NOTIFICATION_QUEUE } from "../common/constants";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import { GovernanceAuthzService } from "./governance-authz.service";
import { GOVERNANCE_PERMISSIONS } from "./governance.constants";
import { PolicyEngineService } from "./policy-engine.service";
import type { ApprovalNotificationJobPayload } from "./governance.types";

const APPROVAL_STEP_INCLUDE = {
  approverUser: {
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true
    }
  },
  flow: {
    include: {
      request: {
        include: {
          requestedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true
            }
          },
          impactSnapshots: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1
          },
          policyEvaluations: {
            orderBy: {
              createdAt: "desc"
            },
            take: 12,
            include: {
              policy: {
                select: {
                  id: true,
                  name: true,
                  target: true,
                  effect: true
                }
              }
            }
          }
        }
      },
      steps: {
        orderBy: {
          stepOrder: "asc"
        },
        include: {
          approverUser: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.ApprovalStepInclude;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authzService: GovernanceAuthzService,
    private readonly policyEngineService: PolicyEngineService,
    private readonly realtimePublisher: RealtimePublisher,
    @InjectQueue(APPROVAL_NOTIFICATION_QUEUE)
    private readonly approvalNotificationQueue: Queue<ApprovalNotificationJobPayload>
  ) {}

  async list(user: AuthUser, status?: string) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.APPROVALS_VIEW);

    const visibilityWhere = await this.authzService.approvalVisibilityWhere(user.id);
    const where: Prisma.ApprovalStepWhereInput = {
      ...visibilityWhere
    };

    if (status && Object.values(ApprovalStepStatus).includes(status as ApprovalStepStatus)) {
      where.status = status as ApprovalStepStatus;
    }

    return this.prismaService.approvalStep.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: APPROVAL_STEP_INCLUDE
    });
  }

  async approve(stepId: string, user: AuthUser, note?: string) {
    return this.decide(stepId, user, "approved", note);
  }

  async reject(stepId: string, user: AuthUser, note?: string) {
    return this.decide(stepId, user, "rejected", note);
  }

  private async decide(stepId: string, user: AuthUser, decision: "approved" | "rejected", note?: string) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.APPROVALS_DECIDE);

    const step = await this.prismaService.approvalStep.findUnique({
      where: { id: stepId },
      include: APPROVAL_STEP_INCLUDE
    });

    if (!step) {
      throw new NotFoundException("Approval step not found");
    }

    if (step.status !== ApprovalStepStatus.pending) {
      throw new BadRequestException("Approval step is already decided");
    }

    const canSeeAllApprovals = await this.authzService.isScopeAll(user.id, PermissionScopeType.approval);
    if (!canSeeAllApprovals && step.approverUserId !== user.id) {
      throw new ForbiddenException("You are not assigned to this approval step");
    }

    const latestImpact = step.flow.request.impactSnapshots[0];
    const policyResult = await this.policyEngineService.evaluateAndLog({
      target: "approval_decide",
      actorUserId: user.id,
      actorRole: user.role,
      request: {
        id: step.flow.request.id,
        type: step.flow.request.type
      },
      impact: {
        riskScore: latestImpact?.riskScore ?? 0,
        blockingIssues: latestImpact?.blockingIssues ?? 0,
        warningIssues: latestImpact?.warningIssues ?? 0
      },
      context: {
        decision,
        note: note ?? null,
        stepId
      }
    });

    if (!policyResult.allowed) {
      await this.approvalNotificationQueue.add(
        APPROVAL_NOTIFICATION_QUEUE,
        {
          kind: "policy_violation",
          requestId: step.flow.request.id,
          userId: step.flow.request.requestedById,
          reason: policyResult.reasons.join("; ")
        },
        {
          jobId: `${APPROVAL_NOTIFICATION_QUEUE}:policy-violation:${step.flow.request.id}:${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: false
        }
      );

      throw new BadRequestException(`Policy violation: ${policyResult.reasons.join("; ")}`);
    }

    const now = new Date();

    const updated = await this.prismaService.$transaction(async (tx) => {
      const updatedStep = await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: decision === "approved" ? ApprovalStepStatus.approved : ApprovalStepStatus.rejected,
          decisionNote: note ?? null,
          decidedAt: now
        }
      });

      const requestId = step.flow.request.id;

      if (decision === "rejected") {
        await tx.approvalFlow.update({
          where: { id: step.flow.id },
          data: {
            status: ApprovalFlowStatus.rejected
          }
        });

        await tx.changeRequest.update({
          where: { id: requestId },
          data: {
            status: ChangeRequestStatus.rejected,
            decidedAt: now
          }
        });
      } else {
        const nextPending = await tx.approvalStep.findFirst({
          where: {
            flowId: step.flow.id,
            status: ApprovalStepStatus.pending,
            stepOrder: {
              gt: step.stepOrder
            }
          },
          orderBy: {
            stepOrder: "asc"
          }
        });

        if (nextPending) {
          await tx.approvalFlow.update({
            where: { id: step.flow.id },
            data: {
              currentStepOrder: nextPending.stepOrder,
              status: ApprovalFlowStatus.pending
            }
          });

          await tx.changeRequest.update({
            where: { id: requestId },
            data: {
              status: ChangeRequestStatus.pending_approval
            }
          });
        } else {
          await tx.approvalFlow.update({
            where: { id: step.flow.id },
            data: {
              status: ApprovalFlowStatus.approved
            }
          });

          await tx.changeRequest.update({
            where: { id: requestId },
            data: {
              status: ChangeRequestStatus.approved,
              decidedAt: now
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: decision === "approved" ? "approval_step_approved" : "approval_step_rejected",
          targetType: "approval_step",
          targetId: stepId,
          metaJson: {
            requestId: step.flow.request.id,
            flowId: step.flow.id,
            note: note ?? null
          }
        }
      });

      return updatedStep;
    });

    await this.approvalNotificationQueue.add(
      APPROVAL_NOTIFICATION_QUEUE,
      {
        kind: "approval_decided",
        requestId: step.flow.request.id,
        requesterUserId: step.flow.request.requestedById,
        decision,
        decisionNote: note
      },
      {
        jobId: `${APPROVAL_NOTIFICATION_QUEUE}:decision:${step.flow.request.id}:${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    await this.realtimePublisher.publishGovernance("approval.decided", {
      stepId,
      requestId: step.flow.request.id,
      decision,
      actorUserId: user.id,
      decidedAt: now.toISOString()
    }, "governance");

    return this.prismaService.approvalStep.findUnique({
      where: { id: updated.id },
      include: APPROVAL_STEP_INCLUDE
    });
  }
}
