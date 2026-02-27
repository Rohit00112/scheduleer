import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import {
  ApprovalFlowStatus,
  ApprovalStepStatus,
  ChangeRequestStatus,
  PolicyTarget,
  UserRole
} from "@prisma/client";
import { Job, Queue } from "bullmq";
import { APPROVAL_NOTIFICATION_QUEUE, REQUEST_EVALUATION_QUEUE } from "../common/constants";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import { PolicyEngineService } from "./policy-engine.service";
import { RequestImpactService } from "./request-impact.service";
import type { ApprovalNotificationJobPayload, RequestEvaluationJobPayload } from "./governance.types";

@Processor(REQUEST_EVALUATION_QUEUE)
export class RequestsEvaluationProcessor extends WorkerHost {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestImpactService: RequestImpactService,
    private readonly policyEngineService: PolicyEngineService,
    private readonly realtimePublisher: RealtimePublisher,
    @InjectQueue(APPROVAL_NOTIFICATION_QUEUE)
    private readonly approvalNotificationQueue: Queue<ApprovalNotificationJobPayload>
  ) {
    super();
  }

  async process(job: Job<RequestEvaluationJobPayload>): Promise<void> {
    const request = await this.prismaService.changeRequest.findUnique({
      where: { id: job.data.requestId }
    });

    if (!request || request.status !== ChangeRequestStatus.submitted) {
      return;
    }

    const impact = await this.requestImpactService.evaluate(request);

    await this.prismaService.changeImpactSnapshot.create({
      data: {
        requestId: request.id,
        riskScore: impact.riskScore,
        blockingIssues: impact.blockingIssues,
        warningIssues: impact.warningIssues,
        impactSummaryJson: impact.summary as never
      }
    });

    const submitPolicy = await this.policyEngineService.evaluateAndLog({
      target: PolicyTarget.request_submit,
      actorUserId: job.data.submittedByUserId,
      request: {
        id: request.id,
        type: request.type
      },
      impact: {
        riskScore: impact.riskScore,
        blockingIssues: impact.blockingIssues,
        warningIssues: impact.warningIssues
      },
      context: {
        source: "requests-evaluation"
      }
    });

    if (!submitPolicy.allowed) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.changeRequest.update({
          where: { id: request.id },
          data: {
            status: ChangeRequestStatus.blocked
          }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: job.data.submittedByUserId,
            action: "change_request_blocked",
            targetType: "change_request",
            targetId: request.id,
            metaJson: {
              reasons: submitPolicy.reasons
            }
          }
        });
      });

      await this.approvalNotificationQueue.add(
        APPROVAL_NOTIFICATION_QUEUE,
        {
          kind: "policy_violation",
          requestId: request.id,
          userId: request.requestedById,
          reason: submitPolicy.reasons.join("; ")
        },
        {
          jobId: `${APPROVAL_NOTIFICATION_QUEUE}:request-policy:${request.id}:${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: false
        }
      );

      return;
    }

    const approver = await this.prismaService.user.findFirst({
      where: {
        active: true,
        role: UserRole.admin,
        id: {
          not: request.requestedById
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true
      }
    });

    const fallbackApprover =
      approver ??
      (await this.prismaService.user.findFirst({
        where: {
          active: true,
          role: UserRole.admin
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true
        }
      }));

    if (!fallbackApprover) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.changeRequest.update({
          where: { id: request.id },
          data: {
            status: ChangeRequestStatus.blocked
          }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: job.data.submittedByUserId,
            action: "change_request_blocked",
            targetType: "change_request",
            targetId: request.id,
            metaJson: {
              reason: "No approver available"
            }
          }
        });
      });

      await this.approvalNotificationQueue.add(
        APPROVAL_NOTIFICATION_QUEUE,
        {
          kind: "policy_violation",
          requestId: request.id,
          userId: request.requestedById,
          reason: "No eligible approver is available."
        },
        {
          jobId: `${APPROVAL_NOTIFICATION_QUEUE}:request-no-approver:${request.id}:${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: false
        }
      );

      return;
    }

    await this.prismaService.$transaction(async (tx) => {
      const flow = await tx.approvalFlow.upsert({
        where: {
          requestId: request.id
        },
        create: {
          requestId: request.id,
          status: ApprovalFlowStatus.pending,
          currentStepOrder: 1
        },
        update: {
          status: ApprovalFlowStatus.pending,
          currentStepOrder: 1
        }
      });

      await tx.approvalStep.upsert({
        where: {
          flowId_stepOrder: {
            flowId: flow.id,
            stepOrder: 1
          }
        },
        create: {
          flowId: flow.id,
          stepOrder: 1,
          approverUserId: fallbackApprover.id,
          status: ApprovalStepStatus.pending,
          decisionNote: null,
          decidedAt: null
        },
        update: {
          approverUserId: fallbackApprover.id,
          status: ApprovalStepStatus.pending,
          decisionNote: null,
          decidedAt: null
        }
      });

      await tx.changeRequest.update({
        where: { id: request.id },
        data: {
          status: ChangeRequestStatus.pending_approval
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: job.data.submittedByUserId,
          action: "change_request_pending_approval",
          targetType: "change_request",
          targetId: request.id,
          metaJson: {
            approverUserId: fallbackApprover.id,
            riskScore: impact.riskScore,
            blockingIssues: impact.blockingIssues,
            warningIssues: impact.warningIssues
          }
        }
      });
    });

    await this.realtimePublisher.publishGovernance("approval.pending", {
      requestId: request.id,
      approverUserId: fallbackApprover.id,
      status: ChangeRequestStatus.pending_approval,
      riskScore: impact.riskScore
    }, "governance");

    await this.approvalNotificationQueue.add(
      APPROVAL_NOTIFICATION_QUEUE,
      {
        kind: "approval_pending",
        requestId: request.id,
        approverUserId: fallbackApprover.id,
        requestTitle: request.title,
        requestType: request.type
      },
      {
        jobId: `${APPROVAL_NOTIFICATION_QUEUE}:pending:${request.id}:${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
  }
}
