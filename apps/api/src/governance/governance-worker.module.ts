import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { APPROVAL_NOTIFICATION_QUEUE, REQUEST_EVALUATION_QUEUE } from "../common/constants";
import { ApprovalsNotificationsProcessor } from "./approvals-notifications.processor";
import { PolicyEngineService } from "./policy-engine.service";
import { RequestImpactService } from "./request-impact.service";
import { RequestsEvaluationProcessor } from "./requests-evaluation.processor";

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: REQUEST_EVALUATION_QUEUE
      },
      {
        name: APPROVAL_NOTIFICATION_QUEUE
      }
    )
  ],
  providers: [
    RequestImpactService,
    PolicyEngineService,
    RequestsEvaluationProcessor,
    ApprovalsNotificationsProcessor
  ]
})
export class GovernanceWorkerModule {}
