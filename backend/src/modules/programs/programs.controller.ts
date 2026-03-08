import {
    Controller,
    Get,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('programs')
@Controller('api/programs')
export class ProgramsController {
    constructor(private readonly programsService: ProgramsService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Get program summary with analytics' })
    getSummary() {
        return this.programsService.getProgramSummary();
    }

    @Get('modules')
    @ApiOperation({ summary: 'Get module catalog' })
    getModules() {
        return this.programsService.getAllModules();
    }

    @Get('assignments')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all teacher assignments' })
    getAssignments() {
        return this.programsService.getAllAssignments();
    }

    @Get('assignments/:moduleCode')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get teacher assignments for a module' })
    getModuleAssignments(@Param('moduleCode') moduleCode: string) {
        return this.programsService.getAssignmentsByModule(moduleCode);
    }
}
