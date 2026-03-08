import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import * as ExcelJS from 'exceljs';

interface SectionGroup {
    section: string;
    schedules: Schedule[];
}

@Injectable()
export class ExportService {
    constructor(
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
    ) { }

    async generateExcel(): Promise<Buffer> {
        const allSchedules = await this.scheduleRepo.find({
            order: { program: 'ASC', year: 'ASC', section: 'ASC' },
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Schedule Manager';

        // Group schedules by program+year for sheet names
        const sheetGroups = this.groupByProgramYear(allSchedules);

        for (const [sheetName, sections] of Object.entries(sheetGroups)) {
            this.createProgramSheet(workbook, sheetName, sections);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private groupByProgramYear(
        schedules: Schedule[],
    ): Record<string, SectionGroup[]> {
        const groups: Record<string, Record<string, Schedule[]>> = {};

        for (const s of schedules) {
            const sheetKey = `${s.program} Y${s.year}`;
            if (!groups[sheetKey]) groups[sheetKey] = {};
            if (!groups[sheetKey][s.section]) groups[sheetKey][s.section] = [];
            groups[sheetKey][s.section].push(s);
        }

        const result: Record<string, SectionGroup[]> = {};
        for (const [sheetName, sectionMap] of Object.entries(groups)) {
            result[sheetName] = Object.entries(sectionMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([section, schedules]) => ({
                    section,
                    schedules: this.sortSchedules(schedules),
                }));
        }
        return result;
    }

    private sortSchedules(schedules: Schedule[]): Schedule[] {
        const dayOrder: Record<string, number> = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
        };
        return schedules.sort((a, b) => {
            const dayDiff = (dayOrder[a.day] ?? 7) - (dayOrder[b.day] ?? 7);
            if (dayDiff !== 0) return dayDiff;
            return a.startTime.localeCompare(b.startTime);
        });
    }

    private createProgramSheet(
        workbook: ExcelJS.Workbook,
        sheetName: string,
        sections: SectionGroup[],
    ) {
        const ws = workbook.addWorksheet(sheetName);

        // Column widths matching original
        ws.columns = [
            { width: 14 },  // A - Day
            { width: 24 },  // B - Time
            { width: 14 },  // C - Class Type
            { width: 8 },   // D - Year
            { width: 14 },  // E - Module Code
            { width: 40 },  // F - Module Title
            { width: 28 },  // G - Lecturer
            { width: 14 },  // H - Group
            { width: 10 },  // I - Block
            { width: 8 },   // J - Level
            { width: 24 },  // K - Room
        ];

        let currentRow = 1;

        for (let sIdx = 0; sIdx < sections.length; sIdx++) {
            const { section, schedules } = sections[sIdx];

            // Determine program full name
            const program = schedules[0]?.program || '';
            const year = schedules[0]?.year || 1;
            const programTitle = this.getProgramTitle(program, year, section);

            // Row 1: University name (merged A:K)
            ws.mergeCells(currentRow, 1, currentRow, 11);
            const uniCell = ws.getCell(currentRow, 1);
            uniCell.value = 'LONDON METROPOLITAN UNIVERSITY';
            uniCell.font = { bold: true, size: 14 };
            uniCell.alignment = { horizontal: 'center', vertical: 'middle' };
            currentRow++;

            // Row 2: Timetable title (merged A:K)
            ws.mergeCells(currentRow, 1, currentRow, 11);
            const titleCell = ws.getCell(currentRow, 1);
            titleCell.value = programTitle;
            titleCell.font = { bold: true, size: 12 };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            currentRow++;

            // Row 3: Headers
            const headers = [
                'Day',
                'Time',
                'Class Type',
                'Year',
                'Module Code',
                'Module Title',
                'Lecturer',
                'Group',
                'Block',
                'Level',
                'Room',
            ];
            const headerRow = ws.getRow(currentRow);
            headers.forEach((h, i) => {
                const cell = headerRow.getCell(i + 1);
                cell.value = h;
                cell.font = { bold: true, size: 10 };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9E1F2' },
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            currentRow++;

            // Data rows
            for (const s of schedules) {
                const row = ws.getRow(currentRow);
                const values = [
                    s.day,
                    `${s.startTime} - ${s.endTime}`,
                    s.classType,
                    String(s.year),
                    s.moduleCode,
                    s.moduleTitle,
                    s.instructor,
                    s.group,
                    s.block,
                    s.level,
                    s.room,
                ];
                values.forEach((v, i) => {
                    const cell = row.getCell(i + 1);
                    cell.value = v;
                    cell.font = { size: 10 };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                    cell.alignment = { vertical: 'middle' };
                });
                currentRow++;
            }

            // Empty row between sections
            currentRow++;
        }
    }

    private getProgramTitle(
        program: string,
        year: number,
        section: string,
    ): string {
        const levelPrefix = `L${year}`;
        if (program === 'BIT') {
            return `BSc (Hons) Computing - ${section} TIMETABLE`;
        } else if (program === 'BBA') {
            return `BA (Hons) - ${section} TIMETABLE`;
        }
        return `${program} - ${section} TIMETABLE`;
    }
}
