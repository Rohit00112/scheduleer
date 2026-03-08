import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { Room } from '../../entities/room.entity';
import { ModuleCatalog } from '../../entities/module-catalog.entity';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';

@Module({
    imports: [TypeOrmModule.forFeature([Schedule, Room, ModuleCatalog])],
    controllers: [InstructorsController],
    providers: [InstructorsService],
    exports: [InstructorsService],
})
export class InstructorsModule { }
