import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../../entities/schedule.entity';
import * as ExcelJS from 'exceljs';

// Time slots in 30-minute intervals from 8:00 AM to 4:00 PM
const TIME_LABELS = [
    '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
    '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
    '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_ORDER: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

// Room definitions matching the original spreadsheet
const ROOMS = [
    { name: 'LT-01 Guildhall', header: 'LT - 01\nGuildhall (90 Blue Desk)', block: 'UK Block\nLevel 2' },
    { name: 'LT-02 Royal Albert Hall', header: 'LT - 02\nRoyal Albert Hall (90 Blue Desk)', block: 'UK Block\nLevel 2' },
    { name: 'LT-03 Greenwich', header: 'LT-03 Greenwich (90 Arm Chair)', block: 'UK Block\nLevel 1' },
    { name: 'LT-04 Regent\'s Park', header: 'LT-04 Regent\'s Park (90 Arm Chair)', block: 'UK Block\nLevel 1' },
    { name: 'SR-01 Islington', header: 'SR - 01\nIslington (48 Blue Desk)', block: 'UK Block\nLevel 1' },
    { name: 'SR-02 Wembley', header: 'SR-02 Wembley (48 Blue Desk)', block: 'UK Block\nLevel 1' },
    { name: 'LT-07 Innovate Tech', header: 'LT-07 Innovate Tech', block: 'ING Block\nLevel 2' },
    { name: 'LT-08 Vairav Tech', header: 'LT-08 Vairav Tech', block: 'ING Block\nLevel 2' },
    { name: 'TR-20 ING Impact', header: 'TR-20 ING Impact', block: 'ING Block\nLevel 1' },
    { name: 'TR-21 ING Tech', header: 'TR-21 ING Tech', block: 'ING Block\nLevel 1' },
    { name: 'TR-22 inRed Labs', header: 'TR-22 inRed Labs', block: 'ING Block\nLevel 1' },
    { name: 'TR-23 ING Skill Academy', header: 'TR-23 ING Skill Academy', block: 'ING Block\nLevel 1' },
    { name: 'TR-01 Arun', header: 'TR-01 Arun (36 Blue Desk)', block: 'Tower Block\nLevel 2' },
    { name: 'TR-02 Barun', header: 'TR-02 Barun (36 Blue Desk)', block: 'Tower Block\nLevel 2' },
    { name: 'TR-03 Tamor', header: 'TR-03 Tamor (33 3 Seater Table)', block: 'Tower Block\nLevel 2' },
    { name: 'TR-04 Sunkoshi', header: 'TR-04 Sunkoshi (33 3 Seater Table)', block: 'Tower Block\nLevel 2' },
    { name: 'TR-05 Terhathum', header: 'TR-05 Terhathum (33 3 Seater Table)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-06 Bhojpur', header: 'TR-06 Bhojpur (33 3 Seater Table)', block: 'Tower Block\nLevel 3' },
    { name: 'Lab-01 Ilam', header: 'Lab - 01\nIlam (30)', block: 'Tower Block\nLevel 3' },
    { name: 'Lab-02 Dhankuta', header: 'Lab - 02 Dhankuta (30)', block: 'Tower Block\nLevel 3' },
    { name: 'Lab-03 Gosainkunda', header: 'Lab-03 Gosainkunda (30)', block: 'Tower Block\nLevel 4' },
    { name: 'TR-07 Begnas', header: 'TR-07 Begnas (33 3 Seater Table)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-09 Shey Phoksundo', header: 'TR-09 Shey Phoksundo (30 3 Seater Table)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-08 Tilicho', header: 'TR-08 Tilicho (30 Table with Sofa bench)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-10 Rara', header: 'TR-10 Rara (30 Table with Sofa bench)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-11 Phewa', header: 'TR-11 Phewa (34 3 Seater Table)', block: 'Tower Block\nLevel 3' },
    { name: 'LT-05 Sagarmatha', header: 'LT-05 Sagarmatha (60 Arm Chair)', block: 'Tower Block\nLevel 2' },
    { name: 'LT-06 Kanchanjunga', header: 'LT-06 Kanchanjunga (60 Arm Chair)', block: 'Tower Block\nLevel 2' },
    { name: 'TR-12 Annapurna', header: 'TR-12 Annapurna (31 3 Seater Table)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-13 Makalu', header: 'TR-13 Makalu (30 Table with Sofa bench)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-14 Lhotse', header: 'TR-14 Lhotse (30 Table with Sofa bench)', block: 'Tower Block\nLevel 3' },
    { name: 'TR-15 Manaslu', header: 'TR-15 Manaslu (30 Table with Sofa bench)', block: 'Tower Block\nLevel 3' },
];

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

        this.createResourceAllocationSheet(workbook, allSchedules);
        this.createModuleViewSheet(workbook, allSchedules);
        this.createWorkloadSheet(workbook, allSchedules);
        this.createProgramSheets(workbook, allSchedules);

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    // ─── Resource Allocation S26 ───────────────────────────────────────
    private createResourceAllocationSheet(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
        const ws = workbook.addWorksheet('Resource Allocation S26');

        const roomCount = ROOMS.length;
        ws.getColumn(1).width = 14;
        for (let i = 0; i < roomCount; i++) {
            ws.getColumn(i + 2).width = 22;
        }

        // Row 1: S26/Class header + Room names
        const row1 = ws.getRow(1);
        row1.getCell(1).value = 'S26/Class';
        row1.getCell(1).font = { bold: true, size: 10 };
        row1.height = 40;
        for (let i = 0; i < roomCount; i++) {
            const cell = row1.getCell(i + 2);
            cell.value = ROOMS[i].header;
            cell.font = { bold: true, size: 8 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = this.thinBorder();
        }

        // Row 2: Day header + Block/Level info
        const row2 = ws.getRow(2);
        row2.getCell(1).value = 'Day';
        row2.getCell(1).font = { bold: true, size: 10 };
        row2.height = 30;
        for (let i = 0; i < roomCount; i++) {
            const cell = row2.getCell(i + 2);
            cell.value = ROOMS[i].block;
            cell.font = { size: 8 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = this.thinBorder();
        }

        // Build a lookup: room -> day -> slotIndex -> schedule info
        const roomLookup = this.buildRoomLookup(schedules);

        let currentRow = 3;
        for (const day of DAYS) {
            // Day header row
            const dayRow = ws.getRow(currentRow);
            dayRow.getCell(1).value = day;
            dayRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            dayRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            for (let i = 0; i < roomCount; i++) {
                const cell = dayRow.getCell(i + 2);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.border = this.thinBorder();
            }
            currentRow++;

            // Time slot rows
            for (let t = 0; t < TIME_LABELS.length; t++) {
                const timeRow = ws.getRow(currentRow);
                timeRow.getCell(1).value = TIME_LABELS[t];
                timeRow.getCell(1).font = { size: 9 };
                timeRow.getCell(1).border = this.thinBorder();

                for (let r = 0; r < roomCount; r++) {
                    const cell = timeRow.getCell(r + 2);
                    const roomName = ROOMS[r].name;
                    const info = roomLookup[roomName]?.[day]?.[t];
                    if (info) {
                        cell.value = `${info.moduleCode} ${info.moduleTitle}`;
                        cell.font = { size: 8 };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: info.color } };
                        cell.alignment = { wrapText: true, vertical: 'middle' };
                    }
                    cell.border = this.thinBorder();
                }
                currentRow++;
            }
        }
    }

    private buildRoomLookup(schedules: Schedule[]): Record<string, Record<string, Record<number, { moduleCode: string; moduleTitle: string; color: string }>>> {
        const lookup: Record<string, Record<string, Record<number, { moduleCode: string; moduleTitle: string; color: string }>>> = {};
        const moduleColors = this.assignModuleColors(schedules);

        for (const s of schedules) {
            const roomKey = this.matchRoom(s.room);
            if (!roomKey) continue;

            if (!lookup[roomKey]) lookup[roomKey] = {};
            if (!lookup[roomKey][s.day]) lookup[roomKey][s.day] = {};

            const startIdx = this.timeToSlotIndex(s.startTime);
            const endIdx = this.timeToSlotIndex(s.endTime);
            if (startIdx < 0) continue;

            const info = {
                moduleCode: s.moduleCode,
                moduleTitle: s.moduleTitle,
                color: moduleColors[s.moduleCode] || 'FFE2EFDA',
            };

            for (let i = startIdx; i < (endIdx >= 0 ? endIdx : startIdx + 3); i++) {
                if (i < TIME_LABELS.length) {
                    lookup[roomKey][s.day][i] = info;
                }
            }
        }
        return lookup;
    }

    private matchRoom(scheduleRoom: string): string | null {
        if (!scheduleRoom) return null;
        const normalized = scheduleRoom.replace(/\s+/g, ' ').trim().toLowerCase();
        for (const room of ROOMS) {
            if (room.name.toLowerCase() === normalized) return room.name;
            const prefix = room.name.split(' ')[0].toLowerCase();
            if (normalized.startsWith(prefix)) return room.name;
        }
        return null;
    }

    private timeToSlotIndex(timeStr: string): number {
        if (!timeStr) return -1;
        const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return -1;
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const period = match[3].toUpperCase();
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        const totalMin = h * 60 + m;
        const baseMin = 8 * 60; // 8:00 AM
        const slotIdx = (totalMin - baseMin) / 30;
        return slotIdx >= 0 && slotIdx < TIME_LABELS.length ? Math.floor(slotIdx) : -1;
    }

    private assignModuleColors(schedules: Schedule[]): Record<string, string> {
        const codes = [...new Set(schedules.map(s => s.moduleCode))].sort();
        const palette = [
            'FF92D050', 'FFFFC000', 'FF00B0F0', 'FFFF6600', 'FF7030A0',
            'FFED7D31', 'FF70AD47', 'FF4472C4', 'FFBF8F00', 'FF00B050',
            'FFFF0000', 'FF0070C0', 'FFFFD966', 'FFA9D18E', 'FFD9E2F3',
            'FFFCE4D6', 'FFE2EFDA', 'FFDAEEF3', 'FFFFF2CC', 'FFD6DCE4',
            'FFB4C6E7', 'FFF8CBAD', 'FFC6EFCE', 'FFFFEB9C',
        ];
        const map: Record<string, string> = {};
        codes.forEach((code, i) => { map[code] = palette[i % palette.length]; });
        return map;
    }

    // ─── Module View ───────────────────────────────────────────────────
    private createModuleViewSheet(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
        const ws = workbook.addWorksheet('Module View');

        const headers = [
            'Day', 'Time Start', 'Time End', 'Hours', 'Class Type', 'Year',
            'Course', 'Specialization', 'Module Code', 'Module Title',
            'Lecturer', 'Group', 'Block', 'Level', 'Room',
        ];

        ws.columns = [
            { width: 12 }, { width: 16 }, { width: 16 }, { width: 8 }, { width: 12 },
            { width: 6 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 36 },
            { width: 28 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 24 },
        ];

        const headerRow = ws.getRow(1);
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = this.thinBorder();
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const sorted = this.sortSchedules(schedules);
        let row = 2;
        for (const s of sorted) {
            const dataRow = ws.getRow(row);
            const course = s.program === 'BIT' ? 'BSc Computing' : s.program === 'BBA' ? 'BBA' : s.program;
            const values: (string | number)[] = [
                s.day, s.startTime, s.endTime, s.hours || 1.5,
                s.classType, s.year, course, s.specialization || '',
                s.moduleCode, s.moduleTitle, s.instructor, s.group,
                s.block, s.level, s.room,
            ];
            values.forEach((v, i) => {
                const cell = dataRow.getCell(i + 1);
                cell.value = v;
                cell.font = { size: 10 };
                cell.border = this.thinBorder();
                cell.alignment = { vertical: 'middle' };
            });
            row++;
        }
    }

    // ─── Workload ──────────────────────────────────────────────────────
    private createWorkloadSheet(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
        const ws = workbook.addWorksheet('Workload');

        const headers = [
            'Day', 'Time Start', 'Time End', 'Hours', 'Class Type', 'Year',
            'Course', 'Specialization', 'Module Code', 'Module Title',
            'Lecturer', 'Group', 'Block', 'Level', 'Room', '', 'Lecturer',
        ];

        ws.columns = [
            { width: 12 }, { width: 16 }, { width: 16 }, { width: 8 }, { width: 12 },
            { width: 6 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 36 },
            { width: 28 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 24 },
            { width: 2 }, { width: 28 },
        ];

        const headerRow = ws.getRow(1);
        headers.forEach((h, i) => {
            if (!h) return;
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = this.thinBorder();
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Sort by instructor, then day, then time
        const sorted = [...schedules].sort((a, b) => {
            const instrCmp = a.instructor.localeCompare(b.instructor);
            if (instrCmp !== 0) return instrCmp;
            const dayDiff = (DAY_ORDER[a.day] ?? 7) - (DAY_ORDER[b.day] ?? 7);
            if (dayDiff !== 0) return dayDiff;
            return a.startTime.localeCompare(b.startTime);
        });

        const instructors = [...new Set(schedules.map(s => s.instructor))].filter(Boolean).sort();

        let row = 2;
        for (const s of sorted) {
            const dataRow = ws.getRow(row);
            const course = s.program === 'BIT' ? 'BSc Computing' : s.program === 'BBA' ? 'BBA' : s.program;
            const values: (string | number)[] = [
                s.day, s.startTime, s.endTime, s.hours || 1.5,
                s.classType, s.year, course, s.specialization || '',
                s.moduleCode, s.moduleTitle, s.instructor, s.group,
                s.block, s.level, s.room,
            ];
            values.forEach((v, i) => {
                const cell = dataRow.getCell(i + 1);
                cell.value = v;
                cell.font = { size: 10 };
                cell.border = this.thinBorder();
                cell.alignment = { vertical: 'middle' };
            });
            row++;
        }

        // Column Q: Instructor list
        for (let i = 0; i < instructors.length; i++) {
            ws.getRow(i + 2).getCell(17).value = instructors[i];
            ws.getRow(i + 2).getCell(17).font = { size: 10 };
        }
    }

    // ─── Program Sheets (BIT Y1, BBA Y3, etc.) ────────────────────────
    private createProgramSheets(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
        const groups: Record<string, Schedule[]> = {};
        for (const s of schedules) {
            const key = `${s.program} Y${s.year}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        }

        const sheetOrder = ['BIT Y1', 'BIT Y2', 'BIT Y3', 'BBA Y1', 'BBA Y2', 'BBA Y3'];
        for (const sheetName of sheetOrder) {
            if (!groups[sheetName]) continue;
            this.createSingleProgramSheet(workbook, sheetName, groups[sheetName]);
        }
    }

    private createSingleProgramSheet(workbook: ExcelJS.Workbook, sheetName: string, schedules: Schedule[]) {
        const ws = workbook.addWorksheet(sheetName);

        const program = schedules[0]?.program || '';
        const year = schedules[0]?.year || 1;
        const programTitle = program === 'BIT'
            ? `BSc (Hons) Computing - L${year}B1 TIMETABLE`
            : `BA (Hons) - L${year}B1 TIMETABLE`;

        ws.columns = [
            { width: 14 }, { width: 24 }, { width: 14 }, { width: 8 },
            { width: 14 }, { width: 40 }, { width: 28 }, { width: 14 },
            { width: 10 }, { width: 8 }, { width: 24 },
        ];

        // Row 1: University name
        ws.mergeCells(1, 1, 1, 11);
        const uniCell = ws.getCell(1, 1);
        uniCell.value = 'LONDON METROPOLITAN UNIVERSITY';
        uniCell.font = { bold: true, size: 14 };
        uniCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 2: Program title
        ws.mergeCells(2, 1, 2, 11);
        const titleCell = ws.getCell(2, 1);
        titleCell.value = programTitle;
        titleCell.font = { bold: true, size: 12 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 3: Headers
        const headers = ['Day', 'Time', 'Class Type', 'Year', 'Module Code', 'Module Title', 'Lecturer', 'Group', 'Block', 'Level', 'Room'];
        const hdrRow = ws.getRow(3);
        headers.forEach((h, i) => {
            const cell = hdrRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = this.thinBorder();
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const sorted = this.sortSchedules(schedules);
        let row = 4;
        for (const s of sorted) {
            const dataRow = ws.getRow(row);
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
                const cell = dataRow.getCell(i + 1);
                cell.value = v;
                cell.font = { size: 10 };
                cell.border = this.thinBorder();
                cell.alignment = { vertical: 'middle' };
            });
            row++;
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────
    private sortSchedules(schedules: Schedule[]): Schedule[] {
        return [...schedules].sort((a, b) => {
            const dayDiff = (DAY_ORDER[a.day] ?? 7) - (DAY_ORDER[b.day] ?? 7);
            if (dayDiff !== 0) return dayDiff;
            return a.startTime.localeCompare(b.startTime);
        });
    }

    private thinBorder(): Partial<ExcelJS.Borders> {
        return {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
        };
    }
}
