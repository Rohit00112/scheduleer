import { Module } from "@nestjs/common";
import { MappingsModule } from "../mappings/mappings.module";
import { ScheduleVersionsModule } from "../schedule-versions/schedule-versions.module";
import { BoardController } from "./board.controller";
import { BoardService } from "./board.service";

@Module({
  imports: [ScheduleVersionsModule, MappingsModule],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService]
})
export class BoardModule {}
