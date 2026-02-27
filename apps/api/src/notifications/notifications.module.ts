import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EMAIL_ALERT_QUEUE } from "../common/constants";
import { MappingsModule } from "../mappings/mappings.module";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_ALERT_QUEUE
    }),
    MappingsModule
  ],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
