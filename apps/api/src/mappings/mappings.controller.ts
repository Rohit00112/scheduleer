import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateUserLecturerMappingDto } from "./dto/create-user-lecturer-mapping.dto";
import { MappingsService } from "./mappings.service";

@Controller("admin/mappings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class MappingsController {
  constructor(private readonly mappingsService: MappingsService) {}

  @Get()
  list() {
    return this.mappingsService.list();
  }

  @Get("options")
  options() {
    return this.mappingsService.options();
  }

  @Post()
  create(@Body() payload: CreateUserLecturerMappingDto) {
    return this.mappingsService.create(payload);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.mappingsService.remove(id);
  }
}
