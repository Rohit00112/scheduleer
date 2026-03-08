import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import {
    CreateScheduleDto,
    UpdateScheduleDto,
    FilterScheduleDto,
} from './schedule.dto';

@Injectable()
export class SchedulesService {
    constructor(
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
    ) { }

    async findAll(filter: FilterScheduleDto): Promise<Schedule[]> {
        const qb = this.scheduleRepo.createQueryBuilder('s');

        if (filter.day) qb.andWhere('s.day = :day', { day: filter.day });
        if (filter.program)
            qb.andWhere('s.program = :program', { program: filter.program });
        if (filter.year) qb.andWhere('s.year = :year', { year: filter.year });
        if (filter.section)
            qb.andWhere('s.section = :section', { section: filter.section });
        if (filter.instructor)
            qb.andWhere('s.instructor LIKE :instructor', {
                instructor: `%${filter.instructor}%`,
            });
        if (filter.room)
            qb.andWhere('s.room LIKE :room', { room: `%${filter.room}%` });
        if (filter.classType)
            qb.andWhere('s.classType = :classType', { classType: filter.classType });
        if (filter.moduleCode)
            qb.andWhere('s.moduleCode = :moduleCode', {
                moduleCode: filter.moduleCode,
            });

        qb.orderBy(
            `CASE s.day
        WHEN 'Sunday' THEN 0
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
      END`,
        ).addOrderBy('s.startTime');

        return qb.getMany();
    }

    async findOne(id: number): Promise<Schedule> {
        const schedule = await this.scheduleRepo.findOne({ where: { id } });
        if (!schedule) throw new NotFoundException(`Schedule #${id} not found`);
        return schedule;
    }

    async create(dto: CreateScheduleDto): Promise<Schedule> {
        const schedule = this.scheduleRepo.create(dto);
        return this.scheduleRepo.save(schedule);
    }

    async update(id: number, dto: UpdateScheduleDto): Promise<Schedule> {
        const schedule = await this.findOne(id);
        Object.assign(schedule, dto);
        return this.scheduleRepo.save(schedule);
    }

    async remove(id: number): Promise<void> {
        const schedule = await this.findOne(id);
        await this.scheduleRepo.remove(schedule);
    }

    async getDistinctInstructors(): Promise<string[]> {
        const result = await this.scheduleRepo
            .createQueryBuilder('s')
            .select('DISTINCT s.instructor', 'instructor')
            .orderBy('s.instructor')
            .getRawMany();
        return result.map((r) => r.instructor);
    }

    async getDistinctRooms(): Promise<string[]> {
        const result = await this.scheduleRepo
            .createQueryBuilder('s')
            .select('DISTINCT s.room', 'room')
            .orderBy('s.room')
            .getRawMany();
        return result.map((r) => r.room);
    }

    async getDistinctPrograms(): Promise<string[]> {
        const result = await this.scheduleRepo
            .createQueryBuilder('s')
            .select('DISTINCT s.program', 'program')
            .orderBy('s.program')
            .getRawMany();
        return result.map((r) => r.program);
    }

    async getDistinctSections(): Promise<string[]> {
        const result = await this.scheduleRepo
            .createQueryBuilder('s')
            .select('DISTINCT s.section', 'section')
            .orderBy('s.section')
            .getRawMany();
        return result.map((r) => r.section);
    }

    async getDistinctModules(): Promise<{ code: string; title: string }[]> {
        const result = await this.scheduleRepo
            .createQueryBuilder('s')
            .select('s.moduleCode', 'code')
            .addSelect('MIN(s.moduleTitle)', 'title')
            .groupBy('s.moduleCode')
            .orderBy('s.moduleCode')
            .getRawMany();
        return result;
    }

    async bulkCreate(dtos: CreateScheduleDto[]): Promise<number> {
        const entities = dtos.map((dto) => this.scheduleRepo.create(dto));
        await this.scheduleRepo.save(entities);
        return entities.length;
    }
}
