import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @Roles("admin", "staff", "viewer")
  listRooms() {
    return this.roomsService.listRooms();
  }

  @Get("availability")
  @Roles("admin", "staff", "viewer")
  availability(
    @Query("date") date: string | undefined,
    @Query("start") start: string,
    @Query("end") end: string
  ) {
    return this.roomsService.availability(date, start, end);
  }

  @Get(":roomId/timeline")
  @Roles("admin", "staff", "viewer")
  timeline(@Param("roomId") roomId: string, @Query("date") date?: string) {
    return this.roomsService.timeline(roomId, date);
  }
}
