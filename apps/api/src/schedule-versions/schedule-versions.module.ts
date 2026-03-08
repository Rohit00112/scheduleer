import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ScheduleVersionsController } from "./schedule-versions.controller";
import { ScheduleVersionsService } from "./schedule-versions.service";

@Module({
  imports: [NotificationsModule],
  controllers: [ScheduleVersionsController],
  providers: [ScheduleVersionsService],
  exports: [ScheduleVersionsService]
})
export class ScheduleVersionsModule {}
