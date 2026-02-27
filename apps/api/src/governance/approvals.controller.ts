import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { GOVERNANCE_PERMISSIONS } from "./governance.constants";
import { ApprovalsService } from "./approvals.service";
import { ApprovalDecisionDto } from "./dto/approval-decision.dto";

@Controller("admin/approvals")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  @Permissions(GOVERNANCE_PERMISSIONS.APPROVALS_VIEW)
  list(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.approvalsService.list(user, status);
  }

  @Post(":stepId/approve")
  @Permissions(GOVERNANCE_PERMISSIONS.APPROVALS_DECIDE)
  approve(
    @CurrentUser() user: AuthUser,
    @Param("stepId") stepId: string,
    @Body() payload: ApprovalDecisionDto
  ) {
    return this.approvalsService.approve(stepId, user, payload.note);
  }

  @Post(":stepId/reject")
  @Permissions(GOVERNANCE_PERMISSIONS.APPROVALS_DECIDE)
  reject(
    @CurrentUser() user: AuthUser,
    @Param("stepId") stepId: string,
    @Body() payload: ApprovalDecisionDto
  ) {
    return this.approvalsService.reject(stepId, user, payload.note);
  }
}
