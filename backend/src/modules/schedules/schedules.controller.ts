import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    ParseIntPipe,
    UseGuards,
    Res,
    StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { ExportService } from './export.service';
import {
    CreateScheduleDto,
    UpdateScheduleDto,
    FilterScheduleDto,
} from './schedule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('schedules')
@Controller('api/schedules')
export class SchedulesController {
    constructor(
        private readonly schedulesService: SchedulesService,
        private readonly exportService: ExportService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all schedules with optional filters' })
    @ApiQuery({ name: 'day', required: false })
    @ApiQuery({ name: 'program', required: false })
    @ApiQuery({ name: 'year', required: false, type: Number })
    @ApiQuery({ name: 'section', required: false })
    @ApiQuery({ name: 'instructor', required: false })
    @ApiQuery({ name: 'room', required: false })
    @ApiQuery({ name: 'classType', required: false })
    @ApiQuery({ name: 'moduleCode', required: false })
    findAll(@Query() filter: FilterScheduleDto) {
        return this.schedulesService.findAll(filter);
    }

    @Get('instructors')
    @ApiOperation({ summary: 'Get all distinct instructors' })
    getInstructors() {
        return this.schedulesService.getDistinctInstructors();
    }

    @Get('rooms')
    @ApiOperation({ summary: 'Get all distinct rooms' })
    getRooms() {
        return this.schedulesService.getDistinctRooms();
    }

    @Get('programs')
    @ApiOperation({ summary: 'Get all distinct programs' })
    getPrograms() {
        return this.schedulesService.getDistinctPrograms();
    }

    @Get('sections')
    @ApiOperation({ summary: 'Get all distinct sections' })
    getSections() {
        return this.schedulesService.getDistinctSections();
    }

    @Get('modules')
    @ApiOperation({ summary: 'Get all distinct modules' })
    getModules() {
        return this.schedulesService.getDistinctModules();
    }

    @Get('export')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Export schedules as Excel file' })
    async exportExcel(@Res() res: Response) {
        const buffer = await this.exportService.generateExcel();
        res.set({
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition':
                'attachment; filename="Time Schedule for Spring 2026.xlsx"',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get schedule by ID' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.schedulesService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new schedule' })
    create(@Body() dto: CreateScheduleDto) {
        return this.schedulesService.create(dto);
    }

    @Post('bulk')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Bulk create schedules' })
    bulkCreate(@Body() dtos: CreateScheduleDto[]) {
        return this.schedulesService.bulkCreate(dtos);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a schedule' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateScheduleDto,
    ) {
        return this.schedulesService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a schedule' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.schedulesService.remove(id);
    }
}
