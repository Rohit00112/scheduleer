import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleCatalog } from '../../entities/module-catalog.entity';
import { TeacherAssignment } from '../../entities/teacher-assignment.entity';
import { Schedule } from '../../entities/schedule.entity';

@Injectable()
export class ProgramsService {
    constructor(
        @InjectRepository(ModuleCatalog)
        private readonly moduleRepo: Repository<ModuleCatalog>,
        @InjectRepository(TeacherAssignment)
        private readonly assignmentRepo: Repository<TeacherAssignment>,
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
    ) { }

    // Module Catalog
    async getAllModules(): Promise<ModuleCatalog[]> {
        return this.moduleRepo.find({ order: { code: 'ASC' } });
    }

    async upsertModule(code: string, title: string): Promise<ModuleCatalog> {
        const existing = await this.moduleRepo.findOne({ where: { code } });
        if (existing) {
            existing.title = title;
            return this.moduleRepo.save(existing);
        }
        return this.moduleRepo.save(this.moduleRepo.create({ code, title }));
    }

    async bulkUpsertModules(modules: { code: string; title: string }[]): Promise<number> {
        let count = 0;
        for (const m of modules) {
            await this.upsertModule(m.code, m.title);
            count++;
        }
        return count;
    }

    // Teacher Assignments
    async getAllAssignments(): Promise<TeacherAssignment[]> {
        return this.assignmentRepo.find({ order: { moduleCode: 'ASC', classType: 'ASC' } });
    }

    async getAssignmentsByModule(moduleCode: string): Promise<TeacherAssignment[]> {
        return this.assignmentRepo.find({
            where: { moduleCode },
            order: { classType: 'ASC' },
        });
    }

    async bulkUpsertAssignments(assignments: Partial<TeacherAssignment>[]): Promise<number> {
        // Clear and re-import
        await this.assignmentRepo.clear();
        for (let i = 0; i < assignments.length; i += 100) {
            const batch = assignments.slice(i, i + 100);
            await this.assignmentRepo
                .createQueryBuilder()
                .insert()
                .into(TeacherAssignment)
                .values(batch as any[])
                .execute();
        }
        return assignments.length;
    }

    // Program Analytics
    async getProgramSummary(): Promise<{
        programs: {
            name: string;
            years: {
                year: number;
                sections: string[];
                totalClasses: number;
                modules: string[];
                instructors: string[];
            }[];
            totalClasses: number;
        }[];
        moduleCatalog: ModuleCatalog[];
        teacherAssignments: TeacherAssignment[];
    }> {
        const schedules = await this.scheduleRepo.find();
        const moduleCatalog = await this.moduleRepo.find({ order: { code: 'ASC' } });
        const teacherAssignments = await this.assignmentRepo.find({ order: { moduleCode: 'ASC' } });

        // Group by program
        const programMap = new Map<string, Schedule[]>();
        for (const s of schedules) {
            const list = programMap.get(s.program) || [];
            list.push(s);
            programMap.set(s.program, list);
        }

        const programs = Array.from(programMap.entries()).map(([name, schedules]) => {
            // Group by year
            const yearMap = new Map<number, Schedule[]>();
            for (const s of schedules) {
                const list = yearMap.get(s.year) || [];
                list.push(s);
                yearMap.set(s.year, list);
            }

            const years = Array.from(yearMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([year, yearSchedules]) => ({
                    year,
                    sections: [...new Set(yearSchedules.map((s) => s.section))].sort(),
                    totalClasses: yearSchedules.length,
                    modules: [...new Set(yearSchedules.map((s) => s.moduleCode))].sort(),
                    instructors: [...new Set(yearSchedules.map((s) => s.instructor))].sort(),
                }));

            return {
                name,
                years,
                totalClasses: schedules.length,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        return { programs, moduleCatalog, teacherAssignments };
    }
}
