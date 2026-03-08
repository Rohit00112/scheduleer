import { Module } from "@nestjs/common";
import { MappingsModule } from "../mappings/mappings.module";
import { ScheduleVersionsModule } from "../schedule-versions/schedule-versions.module";
import { ScheduleController } from "./schedule.controller";
import { ScheduleService } from "./schedule.service";

@Module({
  imports: [ScheduleVersionsModule, MappingsModule],
  controllers: [ScheduleController],
  providers: [ScheduleService]
})
export class ScheduleModule {}
