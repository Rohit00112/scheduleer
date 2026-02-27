import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { BoardService } from "./board.service";

@Controller("board")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get("weekly")
  @Roles("admin", "staff", "viewer")
  weekly(
    @CurrentUser() user: AuthUser,
    @Query("date") date?: string,
    @Query("scope") scope?: "all" | "mine",
    @Query("room") room?: string,
    @Query("course") course?: string,
    @Query("group") group?: string,
    @Query("lecturer") lecturer?: string
  ) {
    return this.boardService.weekly(user.id, {
      date,
      scope,
      room,
      course,
      group,
      lecturer
    });
  }
}
