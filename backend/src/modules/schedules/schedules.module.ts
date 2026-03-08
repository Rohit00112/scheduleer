import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ExportService } from './export.service';

@Module({
    imports: [TypeOrmModule.forFeature([Schedule])],
    controllers: [SchedulesController],
    providers: [SchedulesService, ExportService],
    exports: [SchedulesService],
})
export class SchedulesModule { }
