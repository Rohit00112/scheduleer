import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { Room } from '../../entities/room.entity';
import { ModuleCatalog } from '../../entities/module-catalog.entity';
import { TeacherAssignment } from '../../entities/teacher-assignment.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { ExportService } from './export.service';
import { ConflictService } from './conflict.service';
import { ImportService } from './import.service';
import { AuditService } from './audit.service';

@Module({
    imports: [TypeOrmModule.forFeature([Schedule, AuditLog, Room, ModuleCatalog, TeacherAssignment])],
    controllers: [SchedulesController],
    providers: [SchedulesService, ExportService, ConflictService, ImportService, AuditService],
    exports: [SchedulesService, AuditService],
})
export class SchedulesModule { }
