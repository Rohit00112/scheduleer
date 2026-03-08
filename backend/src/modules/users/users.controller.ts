import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('users')
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @ApiOperation({ summary: 'Get all users' })
    findAll() {
        return this.usersService.findAll();
    }

    @Post()
    @ApiOperation({ summary: 'Create a user' })
    create(@Body() body: { username: string; password: string; role?: UserRole }) {
        return this.usersService.create(body.username, body.password, body.role);
    }

    @Put(':id/role')
    @ApiOperation({ summary: 'Update user role' })
    updateRole(@Param('id', ParseIntPipe) id: number, @Body() body: { role: UserRole }) {
        return this.usersService.updateRole(id, body.role);
    }

    @Put(':id/password')
    @ApiOperation({ summary: 'Reset user password' })
    resetPassword(@Param('id', ParseIntPipe) id: number, @Body() body: { password: string }) {
        return this.usersService.resetPassword(id, body.password);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a user' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.remove(id);
    }
}
