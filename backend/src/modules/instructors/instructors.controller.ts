import {
    Controller,
    Get,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InstructorsService } from './instructors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('instructors')
@Controller('api/instructors')
export class InstructorsController {
    constructor(private readonly instructorsService: InstructorsService) { }

    @Get('dashboard')
    @ApiOperation({ summary: 'Get dashboard statistics overview' })
    getDashboard() {
        return this.instructorsService.getDashboardStats();
    }

    @Get('details')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get detailed instructor info' })
    getDetails() {
        return this.instructorsService.getInstructorDetails();
    }
}
