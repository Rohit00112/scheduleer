import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { ScheduleVersionsService } from "./schedule-versions.service";

@Controller("schedule-versions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleVersionsController {
  constructor(private readonly scheduleVersionsService: ScheduleVersionsService) {}

  @Get()
  @Roles("admin")
  list() {
    return this.scheduleVersionsService.list();
  }

  @Get(":id/issues")
  @Roles("admin")
  issues(@Param("id") id: string) {
    return this.scheduleVersionsService.getIssues(id);
  }

  @Post(":id/activate")
  @Roles("admin")
  activate(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.scheduleVersionsService.activate(id, user.id);
  }
}
