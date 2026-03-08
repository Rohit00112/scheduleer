import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UpdateAlertRuleDto } from "./dto/update-alert-rule.dto";
import { NotificationsService } from "./notifications.service";

@Controller("admin/notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("rules")
  listRules() {
    return this.notificationsService.listRules();
  }

  @Patch("rules/:id")
  updateRule(@Param("id") id: string, @Body() payload: UpdateAlertRuleDto) {
    return this.notificationsService.updateRule(id, payload);
  }
}
