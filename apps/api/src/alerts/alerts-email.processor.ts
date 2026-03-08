import { Processor, WorkerHost } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import nodemailer from "nodemailer";
import { EMAIL_ALERT_QUEUE } from "../common/constants";
import { PrismaService } from "../prisma/prisma.service";
import type { EmailAlertJobPayload } from "../notifications/notifications.service";

@Processor(EMAIL_ALERT_QUEUE)
export class AlertsEmailProcessor extends WorkerHost {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService
  ) {
    super();
  }

  async process(job: Job<EmailAlertJobPayload>): Promise<void> {
    const smtpHost = this.configService.get<string>("SMTP_HOST");
    const smtpPort = Number(this.configService.get<string>("SMTP_PORT") ?? 587);
    const smtpUser = this.configService.get<string>("SMTP_USER");
    const smtpPass = this.configService.get<string>("SMTP_PASS");
    const smtpFrom = this.configService.get<string>("SMTP_FROM") ?? "schedule-hub@localhost";

    try {
      if (!smtpHost || !smtpUser || !smtpPass) {
        throw new Error("SMTP is not configured");
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const result = await transporter.sendMail({
        from: smtpFrom,
        to: job.data.recipient,
        subject: job.data.title,
        text: job.data.message
      });

      await this.prismaService.emailDeliveryLog.update({
        where: { id: job.data.emailDeliveryLogId },
        data: {
          status: "sent",
          providerMessageId: result.messageId,
          error: null
        }
      });
    } catch (error) {
      await this.prismaService.emailDeliveryLog.update({
        where: { id: job.data.emailDeliveryLogId },
        data: {
          status: "failed",
          error: (error as Error).message
        }
      });
    }
  }
}
