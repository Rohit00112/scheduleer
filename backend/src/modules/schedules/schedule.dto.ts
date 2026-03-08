import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateScheduleDto {
    @ApiProperty({ example: 'Monday' })
    @IsString()
    day: string;

    @ApiProperty({ example: '08:00 AM' })
    @IsString()
    startTime: string;

    @ApiProperty({ example: '09:30 AM' })
    @IsString()
    endTime: string;

    @ApiProperty({ example: 'Lecture' })
    @IsString()
    classType: string;

    @ApiProperty({ example: 1 })
    @Type(() => Number)
    @IsNumber()
    year: number;

    @ApiProperty({ example: 'CS4001NT' })
    @IsString()
    moduleCode: string;

    @ApiProperty({ example: 'Programming' })
    @IsString()
    moduleTitle: string;

    @ApiProperty({ example: 'Mr. Binaya Koirala' })
    @IsString()
    instructor: string;

    @ApiProperty({ example: 'C1+C2+C3' })
    @IsString()
    group: string;

    @ApiProperty({ example: 'ING' })
    @IsString()
    block: string;

    @ApiProperty({ example: 2 })
    @IsNumber()
    level: number;

    @ApiProperty({ example: 'LT-08 Vairav Tech' })
    @IsString()
    room: string;

    @ApiProperty({ example: 'BIT' })
    @IsString()
    program: string;

    @ApiProperty({ example: 'L1C1' })
    @IsString()
    section: string;

    @ApiPropertyOptional({ example: 1.5 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    hours?: number;

    @ApiPropertyOptional({ example: 'C [S2]' })
    @IsOptional()
    @IsString()
    specialization?: string;
}

export class UpdateScheduleDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    day?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    startTime?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    endTime?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    classType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    year?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    moduleCode?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    moduleTitle?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    instructor?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    group?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    block?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    level?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    room?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    program?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    section?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    hours?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    specialization?: string;
}

export class FilterScheduleDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    day?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    program?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    year?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    section?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    instructor?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    room?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    classType?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    moduleCode?: string;
}
