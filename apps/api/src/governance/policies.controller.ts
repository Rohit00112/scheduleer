import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { GOVERNANCE_PERMISSIONS } from "./governance.constants";
import { CreatePolicyRuleDto } from "./dto/create-policy-rule.dto";
import { SimulatePolicyDto } from "./dto/simulate-policy.dto";
import { PoliciesService } from "./policies.service";

@Controller("admin/policies")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  @Permissions(GOVERNANCE_PERMISSIONS.POLICIES_VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.policiesService.list(user);
  }

  @Post()
  @Permissions(GOVERNANCE_PERMISSIONS.POLICIES_MANAGE)
  create(@CurrentUser() user: AuthUser, @Body() payload: CreatePolicyRuleDto) {
    return this.policiesService.create(user, payload);
  }

  @Post(":id/simulate")
  @Permissions(GOVERNANCE_PERMISSIONS.POLICIES_MANAGE)
  simulate(@CurrentUser() user: AuthUser, @Param("id") policyId: string, @Body() payload: SimulatePolicyDto) {
    return this.policiesService.simulate(user, policyId, payload);
  }

  @Post(":id/activate")
  @Permissions(GOVERNANCE_PERMISSIONS.POLICIES_MANAGE)
  activate(@CurrentUser() user: AuthUser, @Param("id") policyId: string) {
    return this.policiesService.activate(user, policyId);
  }
}
