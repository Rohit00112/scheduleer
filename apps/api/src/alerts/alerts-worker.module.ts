import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EMAIL_ALERT_QUEUE } from "../common/constants";
import { AlertsEmailProcessor } from "./alerts-email.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_ALERT_QUEUE
    })
  ],
  providers: [AlertsEmailProcessor]
})
export class AlertsWorkerModule {}
