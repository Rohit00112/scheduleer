import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';

export interface Conflict {
    type: 'instructor' | 'room' | 'group';
    day: string;
    startTime: string;
    endTime: string;
    resource: string;
    schedules: Schedule[];
}

@Injectable()
export class ConflictService {
    constructor(
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
    ) { }

    async detectAllConflicts(): Promise<Conflict[]> {
        const all = await this.scheduleRepo.find();
        const conflicts: Conflict[] = [];

        const byDay = this.groupBy(all, (s) => s.day);

        for (const [, daySchedules] of Object.entries(byDay)) {
            conflicts.push(...this.findOverlaps(daySchedules, 'instructor', (s) => s.instructor));
            conflicts.push(...this.findOverlaps(daySchedules, 'room', (s) => s.room));
            conflicts.push(
                ...this.findOverlaps(daySchedules, 'group', (s) => `${s.program}-${s.section}-${s.group}`),
            );
        }

        return conflicts;
    }

    async checkConflictsForSchedule(schedule: Partial<Schedule>, excludeId?: number): Promise<Conflict[]> {
        if (!schedule.day || !schedule.startTime || !schedule.endTime) return [];

        const qb = this.scheduleRepo.createQueryBuilder('s').where('s.day = :day', { day: schedule.day });

        if (excludeId) {
            qb.andWhere('s.id != :id', { id: excludeId });
        }

        const sameDaySchedules = await qb.getMany();
        const conflicts: Conflict[] = [];

        for (const existing of sameDaySchedules) {
            if (!this.timesOverlap(schedule.startTime, schedule.endTime, existing.startTime, existing.endTime)) {
                continue;
            }

            if (schedule.instructor && schedule.instructor === existing.instructor) {
                conflicts.push({
                    type: 'instructor',
                    day: schedule.day,
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    resource: schedule.instructor,
                    schedules: [existing],
                });
            }

            if (schedule.room && schedule.room === existing.room) {
                conflicts.push({
                    type: 'room',
                    day: schedule.day,
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    resource: schedule.room,
                    schedules: [existing],
                });
            }

            const scheduleGroup = `${schedule.program}-${schedule.section}-${schedule.group}`;
            const existingGroup = `${existing.program}-${existing.section}-${existing.group}`;
            if (schedule.group && scheduleGroup === existingGroup) {
                conflicts.push({
                    type: 'group',
                    day: schedule.day,
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    resource: scheduleGroup,
                    schedules: [existing],
                });
            }
        }

        return conflicts;
    }

    private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
        const toMin = (t: string) => {
            const normalized = t.trim().toUpperCase();
            let hours: number, minutes: number;

            if (normalized.includes('AM') || normalized.includes('PM')) {
                const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
                if (!match) return 0;
                hours = parseInt(match[1]);
                minutes = parseInt(match[2]);
                if (match[3] === 'PM' && hours !== 12) hours += 12;
                if (match[3] === 'AM' && hours === 12) hours = 0;
            } else {
                const [h, m] = normalized.split(':').map(Number);
                hours = h;
                minutes = m || 0;
            }
            return hours * 60 + minutes;
        };

        const s1 = toMin(start1),
            e1 = toMin(end1);
        const s2 = toMin(start2),
            e2 = toMin(end2);

        return s1 < e2 && s2 < e1;
    }

    private findOverlaps(
        schedules: Schedule[],
        type: Conflict['type'],
        keyFn: (s: Schedule) => string,
    ): Conflict[] {
        const conflicts: Conflict[] = [];
        const byResource = this.groupBy(schedules, keyFn);

        for (const [resource, resSchedules] of Object.entries(byResource)) {
            if (!resource || resSchedules.length < 2) continue;

            for (let i = 0; i < resSchedules.length; i++) {
                for (let j = i + 1; j < resSchedules.length; j++) {
                    const a = resSchedules[i];
                    const b = resSchedules[j];
                    if (this.timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                        const existing = conflicts.find(
                            (c) =>
                                c.type === type &&
                                c.resource === resource &&
                                c.day === a.day &&
                                c.schedules.some((s) => s.id === a.id),
                        );
                        if (existing) {
                            if (!existing.schedules.some((s) => s.id === b.id)) {
                                existing.schedules.push(b);
                            }
                        } else {
                            conflicts.push({
                                type,
                                day: a.day,
                                startTime: a.startTime,
                                endTime: a.endTime,
                                resource,
                                schedules: [a, b],
                            });
                        }
                    }
                }
            }
        }

        return conflicts;
    }

    private groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
        const map: Record<string, T[]> = {};
        for (const item of items) {
            const key = keyFn(item);
            if (!map[key]) map[key] = [];
            map[key].push(item);
        }
        return map;
    }
}
