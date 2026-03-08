import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { IMPORT_SCHEDULE_QUEUE } from "../common/constants";
import { ImportsService } from "./imports.service";
import type { ImportScheduleJobPayload } from "./imports.types";

@Processor(IMPORT_SCHEDULE_QUEUE)
export class ImportsProcessor extends WorkerHost {
  constructor(private readonly importsService: ImportsService) {
    super();
  }

  async process(job: Job<ImportScheduleJobPayload>): Promise<void> {
    await this.importsService.processImportJob(job.data);
  }
}
