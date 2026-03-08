import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleCatalog } from '../../entities/module-catalog.entity';
import { TeacherAssignment } from '../../entities/teacher-assignment.entity';
import { Schedule } from '../../entities/schedule.entity';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
    imports: [TypeOrmModule.forFeature([ModuleCatalog, TeacherAssignment, Schedule])],
    controllers: [ProgramsController],
    providers: [ProgramsService],
    exports: [ProgramsService],
})
export class ProgramsModule { }
