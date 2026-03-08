import { Controller, ForbiddenException, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { NotificationsService } from "../notifications/notifications.service";

@Controller("alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AlertsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService
  ) {}

  @Post("test-email")
  async testEmail(@CurrentUser() user: AuthUser) {
    const isEnabled = this.configService.get<string>("ENABLE_TEST_EMAIL_ENDPOINT") === "true";
    if (!isEnabled) {
      throw new ForbiddenException("Test email endpoint is disabled in this environment");
    }

    return this.notificationsService.createTestEmail(user.id);
  }
}
