import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { GOVERNANCE_PERMISSIONS } from "./governance.constants";
import { CreateRoomBookingRequestDto } from "./dto/create-room-booking-request.dto";
import { CreateScheduleChangeRequestDto } from "./dto/create-schedule-change-request.dto";
import { SubmitChangeRequestDto } from "./dto/submit-change-request.dto";
import { RequestsService } from "./requests.service";

@Controller("admin/requests")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("admin")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  @Permissions(GOVERNANCE_PERMISSIONS.REQUESTS_VIEW)
  list(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: string,
    @Query("type") type?: string
  ) {
    return this.requestsService.list(user, { status, type });
  }

  @Get(":id")
  @Permissions(GOVERNANCE_PERMISSIONS.REQUESTS_VIEW)
  getById(@CurrentUser() user: AuthUser, @Param("id") requestId: string) {
    return this.requestsService.getById(user, requestId);
  }

  @Post("schedule-change")
  @Permissions(GOVERNANCE_PERMISSIONS.REQUESTS_CREATE_SCHEDULE_CHANGE)
  createScheduleChange(@CurrentUser() user: AuthUser, @Body() payload: CreateScheduleChangeRequestDto) {
    return this.requestsService.createScheduleChange(user, payload);
  }

  @Post("room-booking")
  @Permissions(GOVERNANCE_PERMISSIONS.REQUESTS_CREATE_ROOM_BOOKING)
  createRoomBooking(@CurrentUser() user: AuthUser, @Body() payload: CreateRoomBookingRequestDto) {
    return this.requestsService.createRoomBooking(user, payload);
  }

  @Post(":id/submit")
  @Permissions(GOVERNANCE_PERMISSIONS.REQUESTS_SUBMIT)
  submit(
    @CurrentUser() user: AuthUser,
    @Param("id") requestId: string,
    @Body() payload: SubmitChangeRequestDto
  ) {
    return this.requestsService.submit(user, requestId, payload.note);
  }
}
