import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("admin")
  create(@Body() payload: CreateUserDto) {
    return this.usersService.create(payload);
  }

  @Get()
  @Roles("admin")
  list() {
    return this.usersService.findAll();
  }
}
