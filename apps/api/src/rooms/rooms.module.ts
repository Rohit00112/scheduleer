import { Module } from "@nestjs/common";
import { ScheduleVersionsModule } from "../schedule-versions/schedule-versions.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [ScheduleVersionsModule],
  controllers: [RoomsController],
  providers: [RoomsService]
})
export class RoomsModule {}
