import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { EMAIL_ALERT_QUEUE } from "../common/constants";
import { MappingsService } from "../mappings/mappings.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  triggerType: string;
}

export interface EmailAlertJobPayload {
  emailDeliveryLogId: string;
  recipient: string;
  title: string;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly realtimePublisher: RealtimePublisher,
    private readonly mappingsService: MappingsService,
    @InjectQueue(EMAIL_ALERT_QUEUE)
    private readonly emailAlertsQueue: Queue<EmailAlertJobPayload>
  ) {}

  async listForUser(userId: string) {
    return this.prismaService.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 120
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prismaService.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }

    return this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date()
      }
    });
  }

  async listRules() {
    await this.ensureDefaultRules();
    return this.prismaService.alertRule.findMany({
      orderBy: { name: "asc" }
    });
  }

  async updateRule(ruleId: string, data: { enabled?: boolean; channelInApp?: boolean; channelEmail?: boolean }) {
    const exists = await this.prismaService.alertRule.findUnique({ where: { id: ruleId } });
    if (!exists) {
      throw new NotFoundException("Alert rule not found");
    }

    return this.prismaService.alertRule.update({
      where: { id: ruleId },
      data
    });
  }

  async createNotification(input: CreateNotificationInput) {
    await this.ensureDefaultRules();

    const rule = await this.prismaService.alertRule.findFirst({
      where: {
        triggerType: input.triggerType,
        enabled: true
      }
    });

    if (!rule) {
      return null;
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        active: true
      }
    });

    if (!user || !user.active) {
      return null;
    }

    let createdNotificationId: string | null = null;

    if (rule.channelInApp) {
      const notification = await this.prismaService.notification.create({
        data: {
          userId: user.id,
          type: input.type,
          title: input.title,
          message: input.message,
          payloadJson: input.payload as Prisma.InputJsonValue
        }
      });

      createdNotificationId = notification.id;

      await this.realtimePublisher.publishNotification(
        "notification.created",
        {
          userId: user.id,
          type: input.type,
          message: input.message,
          title: input.title,
          notificationId: notification.id
        },
        `user:${user.id}`
      );
    }

    if (rule.channelEmail) {
      await this.queueEmailDelivery({
        notificationId: createdNotificationId,
        recipient: user.email,
        title: input.title,
        message: input.message
      });
    }

    return createdNotificationId;
  }

  async notifyVersionActivation(params: {
    versionId: string;
    previousVersionId: string | null;
    activatedAt: string;
  }) {
    const users = await this.prismaService.user.findMany({
      where: { active: true },
      select: {
        id: true,
        displayName: true,
        role: true
      }
    });

    for (const user of users) {
      await this.createNotification({
        userId: user.id,
        type: "schedule_activation",
        title: "Schedule activated",
        message: `Version ${params.versionId.slice(0, 8)} is now active.`,
        payload: {
          versionId: params.versionId,
          activatedAt: params.activatedAt
        },
        triggerType: "schedule_activation"
      });

      if (!params.previousVersionId) {
        continue;
      }

      try {
        const scope = await this.mappingsService.resolveLecturerScope(user.id);

        const [oldCount, newCount] = await Promise.all([
          this.prismaService.sessionWeekly.count({
            where: {
              versionId: params.previousVersionId,
              ...this.mappingsService.buildLecturerWhere(scope)
            }
          }),
          this.prismaService.sessionWeekly.count({
            where: {
              versionId: params.versionId,
              ...this.mappingsService.buildLecturerWhere(scope)
            }
          })
        ]);

        if (oldCount !== newCount) {
          await this.createNotification({
            userId: user.id,
            type: "schedule_change",
            title: "Personal schedule changed",
            message: `Your weekly load changed from ${oldCount} to ${newCount} sessions.`,
            payload: {
              previousVersionId: params.previousVersionId,
              versionId: params.versionId,
              oldCount,
              newCount
            },
            triggerType: "schedule_change"
          });
        }
      } catch {
        // Ignore users without mapping context.
      }
    }
  }

  async createTestEmail(userId: string) {
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.queueEmailDelivery({
      notificationId: null,
      recipient: user.email,
      title: "Schedule Hub email test",
      message: "This is a test alert from Schedule Hub."
    });

    return {
      queued: true,
      recipient: user.email
    };
  }

  private async queueEmailDelivery(input: {
    notificationId: string | null;
    recipient: string;
    title: string;
    message: string;
  }) {
    const emailLog = await this.prismaService.emailDeliveryLog.create({
      data: {
        notificationId: input.notificationId,
        recipient: input.recipient,
        status: "queued"
      }
    });

    await this.emailAlertsQueue.add(
      EMAIL_ALERT_QUEUE,
      {
        emailDeliveryLogId: emailLog.id,
        recipient: input.recipient,
        title: input.title,
        message: input.message
      },
      {
        jobId: emailLog.id,
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
  }

  private async ensureDefaultRules() {
    await Promise.all([
      this.prismaService.alertRule.upsert({
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
      this.prismaService.alertRule.upsert({
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
      this.prismaService.alertRule.upsert({
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
}
