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
    UploadedFile,
    UseInterceptors,
    Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { ExportService } from './export.service';
import { ConflictService } from './conflict.service';
import { ImportService } from './import.service';
import { AuditService } from './audit.service';
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
        private readonly conflictService: ConflictService,
        private readonly importService: ImportService,
        private readonly auditService: AuditService,
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

    @Get('conflicts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Detect all scheduling conflicts' })
    getConflicts() {
        return this.conflictService.detectAllConflicts();
    }

    @Post('check-conflicts')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Check conflicts for a schedule entry' })
    checkConflicts(@Body() body: { schedule: Partial<CreateScheduleDto>; excludeId?: number }) {
        return this.conflictService.checkConflictsForSchedule(body.schedule as any, body.excludeId);
    }

    @Get('audit')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get audit log' })
    getAuditLog(@Query('limit') limit?: string, @Query('offset') offset?: string) {
        return this.auditService.findAll(
            limit ? parseInt(limit) : 100,
            offset ? parseInt(offset) : 0,
        );
    }

    @Get('audit/:entityType/:entityId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get audit log for specific entity' })
    getEntityAudit(
        @Param('entityType') entityType: string,
        @Param('entityId', ParseIntPipe) entityId: number,
    ) {
        return this.auditService.findByEntity(entityType, entityId);
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

    @Get('export/csv')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Export schedules as CSV' })
    async exportCsv(@Res() res: Response) {
        const csv = await this.importService.exportCsv();
        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="schedules.csv"',
        });
        res.send(csv);
    }

    @Post('import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Import schedules from Excel file' })
    @UseInterceptors(FileInterceptor('file'))
    async importExcel(
        @UploadedFile() file: Express.Multer.File,
        @Request() req: any,
    ) {
        const result = await this.importService.importExcel(file.buffer);
        await this.auditService.log(
            'import',
            'schedule',
            null,
            req.user.username,
            `Imported ${result.imported} schedules from Excel`,
        );
        return result;
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
    async create(@Body() dto: CreateScheduleDto, @Request() req: any) {
        const schedule = await this.schedulesService.create(dto);
        await this.auditService.log(
            'create',
            'schedule',
            schedule.id,
            req.user.username,
            `Created schedule: ${dto.moduleCode} ${dto.day} ${dto.startTime}`,
            null,
            dto,
        );
        return schedule;
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
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateScheduleDto,
        @Request() req: any,
    ) {
        const old = await this.schedulesService.findOne(id);
        const updated = await this.schedulesService.update(id, dto);
        await this.auditService.log(
            'update',
            'schedule',
            id,
            req.user.username,
            `Updated schedule #${id}`,
            old,
            dto,
        );
        return updated;
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a schedule' })
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
        const old = await this.schedulesService.findOne(id);
        await this.schedulesService.remove(id);
        await this.auditService.log(
            'delete',
            'schedule',
            id,
            req.user.username,
            `Deleted schedule: ${old.moduleCode} ${old.day} ${old.startTime}`,
            old,
        );
    }
}
