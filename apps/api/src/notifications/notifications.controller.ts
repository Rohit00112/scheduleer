import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { NotificationsService } from "./notifications.service";

@Controller("portal/notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles("admin", "staff", "viewer")
  list(@CurrentUser() user: AuthUser) {
    return this.notificationsService.listForUser(user.id);
  }

  @Post(":id/read")
  @Roles("admin", "staff", "viewer")
  markRead(@CurrentUser() user: AuthUser, @Param("id") notificationId: string) {
    return this.notificationsService.markRead(user.id, notificationId);
  }
}
