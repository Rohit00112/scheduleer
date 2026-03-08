import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { ImportsService } from "./imports.service";

@Controller("imports/schedules")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post()
  @Roles("admin")
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: { originalname: string; size: number; buffer: Buffer }, @CurrentUser() user: AuthUser) {
    return this.importsService.upload(file, user.id);
  }

  @Get(":importJobId")
  @Roles("admin")
  getImportStatus(@Param("importJobId") importJobId: string) {
    return this.importsService.getImportJob(importJobId);
  }
}
