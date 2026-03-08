import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ImportService {
    constructor(
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
    ) { }

    async importExcel(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);

        const imported: Partial<Schedule>[] = [];
        const errors: string[] = [];

        workbook.eachSheet((worksheet) => {
            const sheetName = worksheet.name;
            let inDataSection = false;

            worksheet.eachRow((row, rowNumber) => {
                const firstCell = String(row.getCell(1).value || '').trim();

                // Detect header row
                if (firstCell === 'Day') {
                    inDataSection = true;
                    return;
                }

                // Skip title/merged rows
                if (!inDataSection) return;

                // Skip empty rows (section separators)
                if (!firstCell || firstCell === 'LONDON METROPOLITAN UNIVERSITY') {
                    inDataSection = false;
                    return;
                }

                try {
                    const day = firstCell;
                    const timeStr = String(row.getCell(2).value || '');
                    const [startTime, endTime] = timeStr.split('-').map((t: string) => t.trim());
                    const classType = String(row.getCell(3).value || '').trim();
                    const year = parseInt(String(row.getCell(4).value || '0'));
                    const moduleCode = String(row.getCell(5).value || '').trim();
                    const moduleTitle = String(row.getCell(6).value || '').trim();
                    const instructor = String(row.getCell(7).value || '').trim();
                    const group = String(row.getCell(8).value || '').trim();
                    const block = String(row.getCell(9).value || '').trim();
                    const level = parseInt(String(row.getCell(10).value || '0'));
                    const room = String(row.getCell(11).value || '').trim();

                    // Parse program from sheet name
                    const programMatch = sheetName.match(/^(BIT|BBA)/i);
                    const program = programMatch ? programMatch[1].toUpperCase() : sheetName;

                    // Parse section from title rows (we track it in context)
                    const section = this.inferSection(sheetName, rowNumber, worksheet);

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
                            section: section || 'Unknown',
                        });
                    }
                } catch (e) {
                    errors.push(`Sheet "${sheetName}" Row ${rowNumber}: ${(e as Error).message}`);
                }
            });
        });

        if (imported.length > 0) {
            // Clear existing and re-import
            await this.scheduleRepo.clear();
            for (let i = 0; i < imported.length; i += 100) {
                const batch = imported.slice(i, i + 100);
                await this.scheduleRepo
                    .createQueryBuilder()
                    .insert()
                    .into(Schedule)
                    .values(batch as any[])
                    .execute();
            }
        }

        return { imported: imported.length, errors };
    }

    private inferSection(sheetName: string, currentRow: number, worksheet: ExcelJS.Worksheet): string {
        // Walk backwards from current row to find the last title row (contains section like L1C1)
        for (let r = currentRow - 1; r >= 1; r--) {
            const val = String(worksheet.getRow(r).getCell(1).value || '');
            const match = val.match(/L\d+[CB]\d+/i);
            if (match) return match[0].toUpperCase();
            // Stop if we hit a university header
            if (val.includes('LONDON METROPOLITAN')) break;
        }
        return sheetName;
    }

    async exportCsv(): Promise<string> {
        const schedules = await this.scheduleRepo.find({
            order: { program: 'ASC', year: 'ASC', section: 'ASC', day: 'ASC' },
        });

        const headers = [
            'Day',
            'Start Time',
            'End Time',
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
        ];

        const rows = schedules.map((s) =>
            [
                s.day,
                s.startTime,
                s.endTime,
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
            ]
                .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                .join(','),
        );

        return [headers.join(','), ...rows].join('\n');
    }
}
