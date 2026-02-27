import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { IMPORT_SCHEDULE_QUEUE } from "../common/constants";
import { ImportsProcessor } from "./imports.processor";
import { ImportsService } from "./imports.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: IMPORT_SCHEDULE_QUEUE
    })
  ],
  providers: [ImportsService, ImportsProcessor]
})
export class ImportsWorkerModule {}
