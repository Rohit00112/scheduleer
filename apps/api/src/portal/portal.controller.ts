import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { PortalService } from "./portal.service";

@Controller("portal")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get("profile")
  @Roles("admin", "staff", "viewer")
  profile(@CurrentUser() user: AuthUser) {
    return this.portalService.profile(user.id);
  }

  @Get("calendar.ics")
  @Roles("admin", "staff", "viewer")
  async calendar(
    @CurrentUser() user: AuthUser,
    @Query("range") rangeInput: "week" | "month" | undefined,
    @Query("date") date: string | undefined,
    @Res() response: Response
  ) {
    const range = rangeInput === "month" ? "month" : "week";
    const calendarText = await this.portalService.calendarIcs(user.id, range, date);

    response.setHeader("Content-Type", "text/calendar; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="schedule-${range}.ics"`);
    response.send(calendarText);
  }
}
