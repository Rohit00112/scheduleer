import { Module } from "@nestjs/common";
import { MappingsModule } from "../mappings/mappings.module";
import { ScheduleVersionsModule } from "../schedule-versions/schedule-versions.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [ScheduleVersionsModule, MappingsModule],
  controllers: [PortalController],
  providers: [PortalService]
})
export class PortalModule {}
