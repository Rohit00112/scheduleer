import {
    Controller,
    Get,
    Post,
    Delete,
    Patch,
    Param,
    Body,
    ParseIntPipe,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('announcements')
@Controller('api/announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) { }

    @Get()
    @ApiOperation({ summary: 'Get active announcements (public)' })
    findActive() {
        return this.announcementsService.findActive();
    }

    @Get('all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all announcements (admin)' })
    findAll() {
        return this.announcementsService.findAll();
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create announcement' })
    create(@Body() body: { title: string; message: string; type?: string }, @Request() req: any) {
        return this.announcementsService.create({
            ...body,
            createdBy: req.user.username,
        });
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete announcement' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.announcementsService.remove(id);
    }

    @Patch(':id/toggle')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Toggle announcement active state' })
    toggle(@Param('id', ParseIntPipe) id: number) {
        return this.announcementsService.toggleActive(id);
    }
}
