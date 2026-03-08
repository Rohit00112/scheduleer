import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('rooms')
@Controller('api/rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all rooms with metadata' })
    findAll() {
        return this.roomsService.findAll();
    }

    @Get('utilization')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get room utilization statistics' })
    getUtilization() {
        return this.roomsService.getUtilization();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get room by ID' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.roomsService.findOne(id);
    }
}
