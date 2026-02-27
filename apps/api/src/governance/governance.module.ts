import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { APPROVAL_NOTIFICATION_QUEUE, REQUEST_EVALUATION_QUEUE } from "../common/constants";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";
import { GovernanceAuthzService } from "./governance-authz.service";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";
import { PolicyEngineService } from "./policy-engine.service";
import { RequestImpactService } from "./request-impact.service";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";

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
  controllers: [RequestsController, ApprovalsController, PoliciesController],
  providers: [
    GovernanceAuthzService,
    RequestImpactService,
    PolicyEngineService,
    RequestsService,
    ApprovalsService,
    PoliciesService
  ],
  exports: [GovernanceAuthzService, RequestImpactService, PolicyEngineService]
})
export class GovernanceModule {}
