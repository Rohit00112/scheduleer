import { Module } from "@nestjs/common";
import { ScheduleVersionsModule } from "../schedule-versions/schedule-versions.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [ScheduleVersionsModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
