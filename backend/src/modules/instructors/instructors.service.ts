import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { Room } from '../../entities/room.entity';
import { ModuleCatalog } from '../../entities/module-catalog.entity';

@Injectable()
export class InstructorsService {
    constructor(
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
        @InjectRepository(Room)
        private readonly roomRepo: Repository<Room>,
        @InjectRepository(ModuleCatalog)
        private readonly moduleRepo: Repository<ModuleCatalog>,
    ) { }

    async getDashboardStats(): Promise<{
        overview: {
            totalClasses: number;
            totalInstructors: number;
            totalRooms: number;
            totalModules: number;
            totalPrograms: number;
            classTypes: { type: string; count: number }[];
        };
        byDay: { day: string; count: number }[];
        byProgram: { program: string; count: number; year1: number; year2: number; year3: number }[];
        busyInstructors: { instructor: string; classes: number; hours: number }[];
        busyRooms: { room: string; classes: number }[];
        timeDistribution: { slot: string; count: number }[];
    }> {
        const schedules = await this.scheduleRepo.find();

        // Overview
        const instructors = new Set(schedules.map((s) => s.instructor));
        const rooms = new Set(schedules.map((s) => s.room));
        const modules = new Set(schedules.map((s) => s.moduleCode));
        const programs = new Set(schedules.map((s) => s.program));

        const classTypeMap = new Map<string, number>();
        schedules.forEach((s) => classTypeMap.set(s.classType, (classTypeMap.get(s.classType) || 0) + 1));

        // By Day
        const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const dayMap = new Map<string, number>();
        schedules.forEach((s) => dayMap.set(s.day, (dayMap.get(s.day) || 0) + 1));
        const byDay = dayOrder.map((day) => ({ day, count: dayMap.get(day) || 0 }));

        // By Program
        const programYearMap = new Map<string, { total: number; y1: number; y2: number; y3: number }>();
        schedules.forEach((s) => {
            const entry = programYearMap.get(s.program) || { total: 0, y1: 0, y2: 0, y3: 0 };
            entry.total++;
            if (s.year === 1) entry.y1++;
            else if (s.year === 2) entry.y2++;
            else if (s.year === 3) entry.y3++;
            programYearMap.set(s.program, entry);
        });

        const byProgram = Array.from(programYearMap.entries()).map(([program, data]) => ({
            program,
            count: data.total,
            year1: data.y1,
            year2: data.y2,
            year3: data.y3,
        }));

        // Busy instructors (top 10)
        const instrMap = new Map<string, { classes: number; hours: number }>();
        schedules.forEach((s) => {
            const entry = instrMap.get(s.instructor) || { classes: 0, hours: 0 };
            entry.classes++;
            entry.hours += s.hours || 1.5;
            instrMap.set(s.instructor, entry);
        });
        const busyInstructors = Array.from(instrMap.entries())
            .map(([instructor, data]) => ({ instructor, ...data }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 10);

        // Busy rooms (top 10)
        const roomMap = new Map<string, number>();
        schedules.forEach((s) => roomMap.set(s.room, (roomMap.get(s.room) || 0) + 1));
        const busyRooms = Array.from(roomMap.entries())
            .map(([room, classes]) => ({ room, classes }))
            .sort((a, b) => b.classes - a.classes)
            .slice(0, 10);

        // Time distribution
        const timeSlots = [
            '08:00 AM', '09:30 AM', '10:30 AM', '12:00 PM',
            '12:30 PM', '02:00 PM', '02:30 PM', '04:00 PM',
        ];
        const timeMap = new Map<string, number>();
        schedules.forEach((s) => {
            const key = s.startTime.trim();
            timeMap.set(key, (timeMap.get(key) || 0) + 1);
        });
        const timeDistribution = timeSlots
            .filter((slot) => timeMap.has(slot))
            .map((slot) => ({ slot, count: timeMap.get(slot) || 0 }));

        return {
            overview: {
                totalClasses: schedules.length,
                totalInstructors: instructors.size,
                totalRooms: rooms.size,
                totalModules: modules.size,
                totalPrograms: programs.size,
                classTypes: Array.from(classTypeMap.entries()).map(([type, count]) => ({ type, count })),
            },
            byDay,
            byProgram,
            busyInstructors,
            busyRooms,
            timeDistribution,
        };
    }

    async getInstructorDetails(): Promise<{
        instructor: string;
        totalClasses: number;
        totalHours: number;
        modules: string[];
        days: string[];
        classTypes: { type: string; count: number }[];
        programs: string[];
    }[]> {
        const schedules = await this.scheduleRepo.find();

        const instrMap = new Map<string, Schedule[]>();
        schedules.forEach((s) => {
            const list = instrMap.get(s.instructor) || [];
            list.push(s);
            instrMap.set(s.instructor, list);
        });

        return Array.from(instrMap.entries())
            .map(([instructor, classes]) => {
                const typeMap = new Map<string, number>();
                classes.forEach((c) => typeMap.set(c.classType, (typeMap.get(c.classType) || 0) + 1));

                return {
                    instructor,
                    totalClasses: classes.length,
                    totalHours: classes.reduce((sum, c) => sum + (c.hours || 1.5), 0),
                    modules: [...new Set(classes.map((c) => c.moduleCode))].sort(),
                    days: [...new Set(classes.map((c) => c.day))].sort(),
                    classTypes: Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })),
                    programs: [...new Set(classes.map((c) => c.program))].sort(),
                };
            })
            .sort((a, b) => a.instructor.localeCompare(b.instructor));
    }
}
