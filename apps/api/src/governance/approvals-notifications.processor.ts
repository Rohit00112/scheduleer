import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { APPROVAL_NOTIFICATION_QUEUE } from "../common/constants";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import type { ApprovalNotificationJobPayload } from "./governance.types";

@Processor(APPROVAL_NOTIFICATION_QUEUE)
export class ApprovalsNotificationsProcessor extends WorkerHost {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly realtimePublisher: RealtimePublisher
  ) {
    super();
  }

  async process(job: Job<ApprovalNotificationJobPayload>): Promise<void> {
    switch (job.data.kind) {
      case "approval_pending":
        await this.createAndPublish({
          userId: job.data.approverUserId,
          type: "approval_pending",
          title: "Approval pending",
          message: `Request \"${job.data.requestTitle}\" is waiting for your decision.`,
          payload: {
            requestId: job.data.requestId,
            requestType: job.data.requestType
          }
        });
        return;
      case "approval_decided":
        await this.createAndPublish({
          userId: job.data.requesterUserId,
          type: "approval_decided",
          title: `Request ${job.data.decision}`,
          message:
            job.data.decision === "approved"
              ? "Your request has been approved."
              : "Your request has been rejected.",
          payload: {
            requestId: job.data.requestId,
            decision: job.data.decision,
            decisionNote: job.data.decisionNote ?? null
          }
        });
        return;
      case "policy_violation":
        await this.createAndPublish({
          userId: job.data.userId,
          type: "policy_violation",
          title: "Policy violation",
          message: job.data.reason,
          payload: {
            requestId: job.data.requestId
          }
        });
        return;
      default:
        return;
    }
  }

  private async createAndPublish(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: input.userId },
      select: { id: true, active: true }
    });

    if (!user || !user.active) {
      return;
    }

    const notification = await this.prismaService.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        payloadJson: (input.payload ?? null) as never
      }
    });

    await this.realtimePublisher.publishNotification(
      "notification.created",
      {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        notificationId: notification.id
      },
      `user:${input.userId}`
    );
  }
}
