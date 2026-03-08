import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ConflictsService } from "./conflicts.service";

@Controller("conflicts")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConflictsController {
  constructor(private readonly conflictsService: ConflictsService) {}

  @Get()
  @Roles("admin")
  list(
    @Query("versionId") versionId?: string,
    @Query("type") type?: string,
    @Query("severity") severity?: string
  ) {
    return this.conflictsService.list({ versionId, type, severity });
  }
}
