import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import { Room } from '../../entities/room.entity';
import { ModuleCatalog } from '../../entities/module-catalog.entity';
import { TeacherAssignment } from '../../entities/teacher-assignment.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ImportService {
    constructor(
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
        @InjectRepository(Room)
        private readonly roomRepo: Repository<Room>,
        @InjectRepository(ModuleCatalog)
        private readonly moduleRepo: Repository<ModuleCatalog>,
        @InjectRepository(TeacherAssignment)
        private readonly assignmentRepo: Repository<TeacherAssignment>,
    ) { }

    async importExcel(buffer: Buffer): Promise<{
        imported: number;
        rooms: number;
        modules: number;
        assignments: number;
        errors: string[];
    }> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);

        const imported: Partial<Schedule>[] = [];
        const errors: string[] = [];

        // 1. Parse "Data" sheet for module catalog and teacher assignments
        const { modules: catalogModules, assignments } = this.parseDataSheet(workbook);

        // 2. Parse "Resource Allocation" sheet for room metadata
        const roomData = this.parseResourceAllocationSheet(workbook);

        // 3. Parse "Module View" sheet as the primary schedule data source.
        //    It has the complete, canonical data for all programs and years in a
        //    consistent 15-column format.
        this.parseModuleViewSheet(workbook, imported, errors);

        // 4. Parse individual program/year sheets (BIT Y1, BBA Y3, etc.) to
        //    supplement any data missing from Module View.
        this.parseProgramSheets(workbook, imported, errors);

        let importedCount = 0;
        if (imported.length > 0) {
            const seen = new Set<string>();
            const unique = imported.filter((s) => {
                const key = `${s.day}|${s.startTime}|${s.endTime}|${s.classType}|${s.moduleCode}|${s.instructor}|${s.group}|${s.room}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            await this.scheduleRepo.clear();
            for (let i = 0; i < unique.length; i += 100) {
                const batch = unique.slice(i, i + 100);
                await this.scheduleRepo
                    .createQueryBuilder()
                    .insert()
                    .into(Schedule)
                    .values(batch as any[])
                    .execute();
            }
            importedCount = unique.length;
        }

        // Save room metadata
        let roomCount = 0;
        if (roomData.length > 0) {
            for (const r of roomData) {
                const existing = await this.roomRepo.findOne({ where: { name: r.name } });
                if (existing) {
                    Object.assign(existing, r);
                    await this.roomRepo.save(existing);
                } else {
                    await this.roomRepo.save(this.roomRepo.create(r));
                }
                roomCount++;
            }
        }

        // Save module catalog
        let moduleCount = 0;
        if (catalogModules.length > 0) {
            for (const m of catalogModules) {
                const existing = await this.moduleRepo.findOne({ where: { code: m.code } });
                if (existing) {
                    existing.title = m.title;
                    await this.moduleRepo.save(existing);
                } else {
                    await this.moduleRepo.save(this.moduleRepo.create(m));
                }
                moduleCount++;
            }
        }

        // Save teacher assignments
        let assignmentCount = 0;
        if (assignments.length > 0) {
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
            assignmentCount = assignments.length;
        }

        return {
            imported: importedCount,
            rooms: roomCount,
            modules: moduleCount,
            assignments: assignmentCount,
            errors,
        };
    }

    /**
     * Parse the "Data" sheet to extract module catalog and teacher assignments.
     * Columns A-B: Module Code, Module Title
     * Columns D-G: Module Code, Class Type (Role), Teacher, Block
     */
    private parseDataSheet(workbook: ExcelJS.Workbook): {
        modules: { code: string; title: string }[];
        assignments: Partial<TeacherAssignment>[];
    } {
        const modules: { code: string; title: string }[] = [];
        const assignments: Partial<TeacherAssignment>[] = [];

        const ws = workbook.getWorksheet('Data');
        if (!ws) return { modules, assignments };

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            // Module catalog from columns A-B
            const code = String(row.getCell(1).value || '').trim();
            const title = String(row.getCell(2).value || '').trim();
            if (code && title) {
                modules.push({ code, title });
            }

            // Teacher assignments from columns D-G
            const assignCode = String(row.getCell(4).value || '').trim();
            const classType = String(row.getCell(5).value || '').trim();
            const teacher = String(row.getCell(6).value || '').trim();
            const block = String(row.getCell(7).value || '').trim();
            if (assignCode && teacher) {
                assignments.push({
                    moduleCode: assignCode,
                    classType: classType || null,
                    teacher,
                    block: block || null,
                });
            }
        });

        return { modules, assignments };
    }

    /**
     * Parse the "Resource Allocation S26" sheet to extract room metadata.
     * Row 1: Room names with capacity info (e.g., "LT - 01\n  Guildhall (90 Blue Desk)")
     * Row 2: Block and level info (e.g., "UK Block\n  Level 2")
     */
    private parseResourceAllocationSheet(workbook: ExcelJS.Workbook): Partial<Room>[] {
        const rooms: Partial<Room>[] = [];

        const ws = workbook.getWorksheet('Resource Allocation S26');
        if (!ws) return rooms;

        const row1 = ws.getRow(1);
        const row2 = ws.getRow(2);

        for (let col = 2; col <= row1.cellCount; col++) {
            const headerVal = String(row1.getCell(col).value || '').trim();
            const blockVal = String(row2.getCell(col).value || '').trim();

            if (!headerVal) continue;

            // Parse room name: extract the short name (e.g., "LT-07 Innovate Tech" or "TR-01 Arun (36 Blue Desk)")
            const cleanName = headerVal.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

            // Extract capacity from parentheses (e.g., "(90 Blue Desk)" -> 90)
            const capacityMatch = cleanName.match(/\((\d+)\s/);
            const capacity = capacityMatch ? parseInt(capacityMatch[1]) : null;

            // Extract furniture type from parentheses (e.g., "Blue Desk", "3 Seater Table")
            const furnitureMatch = cleanName.match(/\(\d+\s+(.*?)\)/);
            const furnitureType = furnitureMatch ? furnitureMatch[1].trim() : null;

            // Clean room name: remove capacity/furniture part
            const roomName = cleanName.replace(/\s*\(.*?\)/, '').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();

            // Parse block and level from row 2
            const blockClean = blockVal.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            const blockMatch = blockClean.match(/(UK|ING|Tower)\s*(?:Block)?/i);
            const levelMatch = blockClean.match(/Level\s*(\d+)/i);
            const block = blockMatch ? blockMatch[1].replace(/\s*Block/i, '') : '';
            const level = levelMatch ? parseInt(levelMatch[1]) : 0;

            if (roomName) {
                rooms.push({
                    name: roomName,
                    capacity,
                    block,
                    level: String(level),
                    furnitureType,
                });
            }
        }

        return rooms;
    }

    /**
     * Parse "Module View" sheet as fallback - it has 15 columns:
     * Day, Time Start, Time End, Hours, Class Type, Year, Course, Specialization,
     * Module Code, Module Title, Lecturer, Group, Block, Level, Room
     */
    private parseModuleViewSheet(
        workbook: ExcelJS.Workbook,
        imported: Partial<Schedule>[],
        errors: string[],
    ): void {
        const ws = workbook.getWorksheet('Module View');
        if (!ws) return;

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            try {
                const day = String(row.getCell(1).value || '').trim();
                if (!day || day === 'Day') return;

                const startTimeRaw = row.getCell(2).value;
                const endTimeRaw = row.getCell(3).value;
                const startTime = this.formatTimeValue(startTimeRaw);
                const endTime = this.formatTimeValue(endTimeRaw);
                const hours = parseFloat(String(row.getCell(4).value || '1.5'));
                const classType = String(row.getCell(5).value || '').trim();
                const year = parseInt(String(row.getCell(6).value || '0'));
                const course = String(row.getCell(7).value || '').trim();
                const specialization = String(row.getCell(8).value || '').trim();
                const moduleCode = String(row.getCell(9).value || '').trim();
                const moduleTitle = String(row.getCell(10).value || '').trim();
                const instructor = String(row.getCell(11).value || '').trim();
                const group = String(row.getCell(12).value || '').trim();
                const block = String(row.getCell(13).value || '').trim();
                const level = parseInt(String(row.getCell(14).value || '0'));
                const room = String(row.getCell(15).value || '').trim();

                const program = course.toUpperCase().startsWith('B') ?
                    (course.toUpperCase().includes('BIT') || course.toUpperCase().includes('BSC') ? 'BIT' : 'BBA') :
                    course || 'Unknown';

                // Derive section from specialization (e.g., "C [S2]" -> L{year}C{group_first_char})
                const sectionMatch = specialization.match(/^([CB])\s*\[S(\d+)\]/i);
                const section = sectionMatch ? `L${year}${sectionMatch[1].toUpperCase()}${group.replace(/[^0-9]/g, '').charAt(0) || '1'}` : `L${year}`;

                if (day && startTime && endTime && moduleCode) {
                    imported.push({
                        day,
                        startTime,
                        endTime,
                        classType,
                        year: year || 1,
                        moduleCode,
                        moduleTitle,
                        instructor,
                        group,
                        block,
                        level: level || year,
                        room,
                        program,
                        section,
                        hours: hours || 1.5,
                        specialization: specialization || undefined,
                    });
                }
            } catch (e) {
                errors.push(`Module View Row ${rowNumber}: ${(e as Error).message}`);
            }
        });
    }

    /**
     * Parse individual program/year sheets (e.g., "BIT Y1", "BBA Y3").
     * These have 11 columns: Day, Time (combined), Class Type, Year,
     * Module Code, Module Title, Lecturer, Group, Block, Level, Room.
     * Header is in row 3 (rows 1-2 are title rows).
     */
    private parseProgramSheets(
        workbook: ExcelJS.Workbook,
        imported: Partial<Schedule>[],
        errors: string[],
    ): void {
        const sheetConfigs = [
            { name: 'BIT Y1', program: 'BIT', year: 1 },
            { name: 'BIT Y2', program: 'BIT', year: 2 },
            { name: 'BIT Y3', program: 'BIT', year: 3 },
            { name: 'BBA Y1', program: 'BBA', year: 1 },
            { name: 'BBA Y2', program: 'BBA', year: 2 },
            { name: 'BBA Y3', program: 'BBA', year: 3 },
        ];

        for (const config of sheetConfigs) {
            const ws = workbook.getWorksheet(config.name);
            if (!ws) continue;

            ws.eachRow((row, rowNumber) => {
                if (rowNumber <= 3) return; // Skip title rows and header

                try {
                    const day = String(row.getCell(1).value || '').trim();
                    if (!day || !['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(day)) return;

                    // Time is combined: "08:00 AM - 09:30 AM"
                    const timeRaw = String(row.getCell(2).value || '').trim();
                    const timeParts = timeRaw.split(/\s*-\s*/);
                    if (timeParts.length < 2) return;
                    const startTime = timeParts[0].trim();
                    const endTime = timeParts[1].trim();

                    const classType = String(row.getCell(3).value || '').trim();
                    const year = parseInt(String(row.getCell(4).value || config.year.toString()));
                    const moduleCode = String(row.getCell(5).value || '').trim();
                    const moduleTitle = String(row.getCell(6).value || '').trim();
                    const instructor = String(row.getCell(7).value || '').trim();
                    const group = String(row.getCell(8).value || '').trim();
                    const block = String(row.getCell(9).value || '').trim();
                    const level = parseInt(String(row.getCell(10).value || '0'));
                    const room = String(row.getCell(11).value || '').trim();

                    const section = `L${year || config.year}`;
                    const hours = this.calculateHours(startTime, endTime);

                    if (day && startTime && endTime && moduleCode) {
                        imported.push({
                            day,
                            startTime,
                            endTime,
                            classType,
                            year: year || config.year,
                            moduleCode,
                            moduleTitle,
                            instructor,
                            group,
                            block,
                            level: level || year || config.year,
                            room,
                            program: config.program,
                            section,
                            hours: hours || 1.5,
                        });
                    }
                } catch (e) {
                    errors.push(`${config.name} Row ${rowNumber}: ${(e as Error).message}`);
                }
            });
        }
    }

    private calculateHours(startTime: string, endTime: string): number {
        const toMinutes = (t: string): number => {
            if (!t) return 0;
            const match = t.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (!match) return 0;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const period = match[3]?.toUpperCase();
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        };
        const diff = toMinutes(endTime) - toMinutes(startTime);
        return diff > 0 ? diff / 60 : 1.5;
    }

    private formatTimeValue(val: unknown): string {
        if (!val) return '';
        if (val instanceof Date) {
            const h = val.getUTCHours();
            const m = val.getUTCMinutes();
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
        }
        const str = String(val);
        // Handle "HH:MM:SS" time format from Excel
        const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (timeMatch) {
            const h = parseInt(timeMatch[1]);
            const m = parseInt(timeMatch[2]);
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
        }
        return str.trim();
    }

    async exportCsv(): Promise<string> {
        const schedules = await this.scheduleRepo.find({
            order: { program: 'ASC', year: 'ASC', section: 'ASC', day: 'ASC' },
        });

        const headers = [
            'Day',
            'Start Time',
            'End Time',
            'Hours',
            'Class Type',
            'Year',
            'Module Code',
            'Module Title',
            'Instructor',
            'Group',
            'Block',
            'Level',
            'Room',
            'Program',
            'Section',
            'Specialization',
        ];

        const rows = schedules.map((s) =>
            [
                s.day,
                s.startTime,
                s.endTime,
                s.hours || 1.5,
                s.classType,
                s.year,
                s.moduleCode,
                s.moduleTitle,
                s.instructor,
                s.group,
                s.block,
                s.level,
                s.room,
                s.program,
                s.section,
                s.specialization || '',
            ]
                .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                .join(','),
        );

        return [headers.join(','), ...rows].join('\n');
    }
}
