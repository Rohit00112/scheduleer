import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { IMPORT_SCHEDULE_QUEUE } from "../common/constants";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: IMPORT_SCHEDULE_QUEUE
    })
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService]
})
export class ImportsModule {}
