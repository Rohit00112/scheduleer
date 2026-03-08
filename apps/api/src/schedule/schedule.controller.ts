import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { ScheduleService } from "./schedule.service";

@Controller("schedule")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get("my")
  @Roles("admin", "staff", "viewer")
  mySchedule(@CurrentUser() user: AuthUser, @Query("date") date?: string) {
    return this.scheduleService.mySchedule(user.id, date);
  }

  @Get("search")
  @Roles("admin", "staff", "viewer")
  search(
    @Query("day") day?: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
    @Query("room") room?: string,
    @Query("lecturer") lecturer?: string,
    @Query("group") group?: string,
    @Query("course") course?: string
  ) {
    return this.scheduleService.search({ day, start, end, room, lecturer, group, course });
  }
}
