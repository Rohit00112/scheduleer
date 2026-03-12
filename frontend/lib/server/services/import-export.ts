import ExcelJS from "exceljs";
import type { Repository } from "typeorm";

import { getRepositories } from "./repositories";
import { ModuleCatalog, Room, Schedule, TeacherAssignment } from "../entities";

const TIME_LABELS = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const ROOMS = [
  { name: "LT-01 Guildhall", header: "LT - 01\nGuildhall (90 Blue Desk)", block: "UK Block\nLevel 2" },
  { name: "LT-02 Royal Albert Hall", header: "LT - 02\nRoyal Albert Hall (90 Blue Desk)", block: "UK Block\nLevel 2" },
  { name: "LT-03 Greenwich", header: "LT-03 Greenwich (90 Arm Chair)", block: "UK Block\nLevel 1" },
  { name: "LT-04 Regent's Park", header: "LT-04 Regent's Park (90 Arm Chair)", block: "UK Block\nLevel 1" },
  { name: "SR-01 Islington", header: "SR - 01\nIslington (48 Blue Desk)", block: "UK Block\nLevel 1" },
  { name: "SR-02 Wembley", header: "SR-02 Wembley (48 Blue Desk)", block: "UK Block\nLevel 1" },
  { name: "LT-07 Innovate Tech", header: "LT-07 Innovate Tech", block: "ING Block\nLevel 2" },
  { name: "LT-08 Vairav Tech", header: "LT-08 Vairav Tech", block: "ING Block\nLevel 2" },
  { name: "TR-20 ING Impact", header: "TR-20 ING Impact", block: "ING Block\nLevel 1" },
  { name: "TR-21 ING Tech", header: "TR-21 ING Tech", block: "ING Block\nLevel 1" },
  { name: "TR-22 inRed Labs", header: "TR-22 inRed Labs", block: "ING Block\nLevel 1" },
  { name: "TR-23 ING Skill Academy", header: "TR-23 ING Skill Academy", block: "ING Block\nLevel 1" },
  { name: "TR-01 Arun", header: "TR-01 Arun (36 Blue Desk)", block: "Tower Block\nLevel 2" },
  { name: "TR-02 Barun", header: "TR-02 Barun (36 Blue Desk)", block: "Tower Block\nLevel 2" },
  { name: "TR-03 Tamor", header: "TR-03 Tamor (33 3 Seater Table)", block: "Tower Block\nLevel 2" },
  { name: "TR-04 Sunkoshi", header: "TR-04 Sunkoshi (33 3 Seater Table)", block: "Tower Block\nLevel 2" },
  { name: "TR-05 Terhathum", header: "TR-05 Terhathum (33 3 Seater Table)", block: "Tower Block\nLevel 3" },
  { name: "TR-06 Bhojpur", header: "TR-06 Bhojpur (33 3 Seater Table)", block: "Tower Block\nLevel 3" },
  { name: "Lab-01 Ilam", header: "Lab - 01\nIlam (30)", block: "Tower Block\nLevel 3" },
  { name: "Lab-02 Dhankuta", header: "Lab - 02 Dhankuta (30)", block: "Tower Block\nLevel 3" },
  { name: "Lab-03 Gosainkunda", header: "Lab-03 Gosainkunda (30)", block: "Tower Block\nLevel 4" },
  { name: "TR-07 Begnas", header: "TR-07 Begnas (33 3 Seater Table)", block: "Tower Block\nLevel 3" },
  { name: "TR-09 Shey Phoksundo", header: "TR-09 Shey Phoksundo (30 3 Seater Table)", block: "Tower Block\nLevel 3" },
  { name: "TR-08 Tilicho", header: "TR-08 Tilicho (30 Table with Sofa bench)", block: "Tower Block\nLevel 3" },
  { name: "TR-10 Rara", header: "TR-10 Rara (30 Table with Sofa bench)", block: "Tower Block\nLevel 3" },
  { name: "TR-11 Phewa", header: "TR-11 Phewa (34 3 Seater Table)", block: "Tower Block\nLevel 3" },
  { name: "LT-05 Sagarmatha", header: "LT-05 Sagarmatha (60 Arm Chair)", block: "Tower Block\nLevel 2" },
  { name: "LT-06 Kanchanjunga", header: "LT-06 Kanchanjunga (60 Arm Chair)", block: "Tower Block\nLevel 2" },
  { name: "TR-12 Annapurna", header: "TR-12 Annapurna (31 3 Seater Table)", block: "Tower Block\nLevel 3" },
  { name: "TR-13 Makalu", header: "TR-13 Makalu (30 Table with Sofa bench)", block: "Tower Block\nLevel 3" },
  { name: "TR-14 Lhotse", header: "TR-14 Lhotse (30 Table with Sofa bench)", block: "Tower Block\nLevel 3" },
  { name: "TR-15 Manaslu", header: "TR-15 Manaslu (30 Table with Sofa bench)", block: "Tower Block\nLevel 3" },
];

class ImportExportService {
  constructor(
    private readonly scheduleRepo: Repository<Schedule>,
    private readonly roomRepo: Repository<Room>,
    private readonly moduleRepo: Repository<ModuleCatalog>,
    private readonly assignmentRepo: Repository<TeacherAssignment>,
  ) {}

  async generateExcel(): Promise<Buffer> {
    const allSchedules = await this.scheduleRepo.find({
      order: { program: "ASC", year: "ASC", section: "ASC" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Schedule Manager";

    this.createResourceAllocationSheet(workbook, allSchedules);
    this.createModuleViewSheet(workbook, allSchedules);
    this.createWorkloadSheet(workbook, allSchedules);
    this.createProgramSheets(workbook, allSchedules);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importExcel(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    const workbookBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(workbookBuffer);

    const imported: Partial<Schedule>[] = [];
    const errors: string[] = [];

    const { modules: catalogModules, assignments } = this.parseDataSheet(workbook);
    const roomData = this.parseResourceAllocationSheet(workbook);

    this.parseModuleViewSheet(workbook, imported, errors);
    this.parseProgramSheets(workbook, imported, errors);

    let importedCount = 0;
    if (imported.length > 0) {
      const seen = new Set<string>();
      const unique = imported.filter((schedule) => {
        const key = [
          schedule.day,
          schedule.startTime,
          schedule.endTime,
          schedule.classType,
          schedule.moduleCode,
          schedule.instructor,
          schedule.group,
          schedule.room,
        ]
          .join("|")
          .toLowerCase();

        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      await this.scheduleRepo.clear();
      for (let index = 0; index < unique.length; index += 100) {
        const batch = unique.slice(index, index + 100);
        await this.scheduleRepo
          .createQueryBuilder()
          .insert()
          .into(Schedule)
          .values(batch as Schedule[])
          .execute();
      }
      importedCount = unique.length;
    }

    let roomCount = 0;
    if (roomData.length > 0) {
      for (const room of roomData) {
        const existing = await this.roomRepo.findOne({ where: { name: room.name } });
        if (existing) {
          Object.assign(existing, room);
          await this.roomRepo.save(existing);
        } else {
          await this.roomRepo.save(this.roomRepo.create(room));
        }
        roomCount += 1;
      }
    }

    let moduleCount = 0;
    if (catalogModules.length > 0) {
      for (const moduleItem of catalogModules) {
        const existing = await this.moduleRepo.findOne({ where: { code: moduleItem.code } });
        if (existing) {
          existing.title = moduleItem.title;
          await this.moduleRepo.save(existing);
        } else {
          await this.moduleRepo.save(this.moduleRepo.create(moduleItem));
        }
        moduleCount += 1;
      }
    }

    let assignmentCount = 0;
    if (assignments.length > 0) {
      await this.assignmentRepo.clear();
      for (let index = 0; index < assignments.length; index += 100) {
        const batch = assignments.slice(index, index + 100);
        await this.assignmentRepo
          .createQueryBuilder()
          .insert()
          .into(TeacherAssignment)
          .values(batch as TeacherAssignment[])
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

  async exportCsv(): Promise<string> {
    const schedules = await this.scheduleRepo.find({
      order: { program: "ASC", year: "ASC", section: "ASC", day: "ASC" },
    });

    const headers = [
      "Day",
      "Start Time",
      "End Time",
      "Hours",
      "Class Type",
      "Year",
      "Module Code",
      "Module Title",
      "Instructor",
      "Group",
      "Block",
      "Level",
      "Room",
      "Program",
      "Section",
      "Specialization",
    ];

    const rows = schedules.map((schedule) =>
      [
        schedule.day,
        schedule.startTime,
        schedule.endTime,
        schedule.hours || 1.5,
        schedule.classType,
        schedule.year,
        schedule.moduleCode,
        schedule.moduleTitle,
        schedule.instructor,
        schedule.group,
        schedule.block,
        schedule.level,
        schedule.room,
        schedule.program,
        schedule.section,
        schedule.specialization || "",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    return [headers.join(","), ...rows].join("\n");
  }

  private parseDataSheet(workbook: ExcelJS.Workbook) {
    const modules: { code: string; title: string }[] = [];
    const assignments: Partial<TeacherAssignment>[] = [];

    const worksheet = workbook.getWorksheet("Data");
    if (!worksheet) {
      return { modules, assignments };
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const code = String(row.getCell(1).value || "").trim();
      const title = String(row.getCell(2).value || "").trim();
      if (code && title) {
        modules.push({ code, title });
      }

      const assignmentCode = String(row.getCell(4).value || "").trim();
      const classType = String(row.getCell(5).value || "").trim();
      const teacher = String(row.getCell(6).value || "").trim();
      const block = String(row.getCell(7).value || "").trim();
      if (assignmentCode && teacher) {
        assignments.push({
          moduleCode: assignmentCode,
          classType: classType || null,
          teacher,
          block: block || null,
        });
      }
    });

    return { modules, assignments };
  }

  private parseResourceAllocationSheet(workbook: ExcelJS.Workbook): Partial<Room>[] {
    const rooms: Partial<Room>[] = [];
    const worksheet = workbook.getWorksheet("Resource Allocation S26");
    if (!worksheet) {
      return rooms;
    }

    const row1 = worksheet.getRow(1);
    const row2 = worksheet.getRow(2);

    for (let col = 2; col <= row1.cellCount; col += 1) {
      const headerValue = String(row1.getCell(col).value || "").trim();
      const blockValue = String(row2.getCell(col).value || "").trim();

      if (!headerValue) {
        continue;
      }

      const cleanName = headerValue.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      const capacityMatch = cleanName.match(/\((\d+)\s/);
      const capacity = capacityMatch ? Number.parseInt(capacityMatch[1], 10) : null;
      const furnitureMatch = cleanName.match(/\(\d+\s+(.*?)\)/);
      const furnitureType = furnitureMatch ? furnitureMatch[1].trim() : null;
      const roomName = cleanName
        .replace(/\s*\(.*?\)/, "")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const blockClean = blockValue.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      const blockMatch = blockClean.match(/(UK|ING|Tower)\s*(?:Block)?/i);
      const levelMatch = blockClean.match(/Level\s*(\d+)/i);
      const block = blockMatch ? blockMatch[1].replace(/\s*Block/i, "") : "";
      const level = levelMatch ? Number.parseInt(levelMatch[1], 10) : 0;

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

  private parseModuleViewSheet(
    workbook: ExcelJS.Workbook,
    imported: Partial<Schedule>[],
    errors: string[],
  ) {
    const worksheet = workbook.getWorksheet("Module View");
    if (!worksheet) {
      return;
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      try {
        const day = String(row.getCell(1).value || "").trim();
        if (!day || day === "Day") {
          return;
        }

        const startTime = this.formatTimeValue(row.getCell(2).value);
        const endTime = this.formatTimeValue(row.getCell(3).value);
        const hours = Number.parseFloat(String(row.getCell(4).value || "1.5"));
        const classType = String(row.getCell(5).value || "").trim();
        const year = Number.parseInt(String(row.getCell(6).value || "0"), 10);
        const course = String(row.getCell(7).value || "").trim();
        const specialization = String(row.getCell(8).value || "").trim();
        const moduleCode = String(row.getCell(9).value || "").trim();
        const moduleTitle = String(row.getCell(10).value || "").trim();
        const instructor = this.normalizeName(String(row.getCell(11).value || "").trim());
        const group = String(row.getCell(12).value || "").trim();
        const block = String(row.getCell(13).value || "").trim();
        const level = Number.parseInt(String(row.getCell(14).value || "0"), 10);
        const room = String(row.getCell(15).value || "").trim();

        const program = course.toUpperCase().startsWith("B")
          ? course.toUpperCase().includes("BIT") || course.toUpperCase().includes("BSC")
            ? "BIT"
            : "BBA"
          : course || "Unknown";

        const sectionMatch = specialization.match(/^([CB])\s*\[S(\d+)\]/i);
        const section = sectionMatch
          ? `L${year}${sectionMatch[1].toUpperCase()}${group.replace(/[^0-9]/g, "").charAt(0) || "1"}`
          : `L${year}`;

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
      } catch (error) {
        errors.push(`Module View Row ${rowNumber}: ${(error as Error).message}`);
      }
    });
  }

  private parseProgramSheets(
    workbook: ExcelJS.Workbook,
    imported: Partial<Schedule>[],
    errors: string[],
  ) {
    const sheetConfigs = [
      { name: "BIT Y1", program: "BIT", year: 1 },
      { name: "BIT Y2", program: "BIT", year: 2 },
      { name: "BIT Y3", program: "BIT", year: 3 },
      { name: "BBA Y1", program: "BBA", year: 1 },
      { name: "BBA Y2", program: "BBA", year: 2 },
      { name: "BBA Y3", program: "BBA", year: 3 },
    ];

    for (const config of sheetConfigs) {
      const worksheet = workbook.getWorksheet(config.name);
      if (!worksheet) {
        continue;
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) {
          return;
        }

        try {
          const day = String(row.getCell(1).value || "").trim();
          if (
            !day ||
            !["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].includes(day)
          ) {
            return;
          }

          const timeRaw = String(row.getCell(2).value || "").trim();
          const timeParts = timeRaw.split(/\s*-\s*/);
          if (timeParts.length < 2) {
            return;
          }

          const startTime = timeParts[0].trim();
          const endTime = timeParts[1].trim();
          const classType = String(row.getCell(3).value || "").trim();
          const year = Number.parseInt(String(row.getCell(4).value || config.year.toString()), 10);
          const moduleCode = String(row.getCell(5).value || "").trim();
          const moduleTitle = String(row.getCell(6).value || "").trim();
          const instructor = this.normalizeName(String(row.getCell(7).value || "").trim());
          const group = String(row.getCell(8).value || "").trim();
          const block = String(row.getCell(9).value || "").trim();
          const level = Number.parseInt(String(row.getCell(10).value || "0"), 10);
          const room = String(row.getCell(11).value || "").trim();
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
        } catch (error) {
          errors.push(`${config.name} Row ${rowNumber}: ${(error as Error).message}`);
        }
      });
    }
  }

  private calculateHours(startTime: string, endTime: string): number {
    const toMinutes = (time: string) => {
      const match = time.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) {
        return 0;
      }

      let hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);
      const period = match[3]?.toUpperCase();
      if (period === "PM" && hours !== 12) {
        hours += 12;
      }
      if (period === "AM" && hours === 12) {
        hours = 0;
      }
      return hours * 60 + minutes;
    };

    const diff = toMinutes(endTime) - toMinutes(startTime);
    return diff > 0 ? diff / 60 : 1.5;
  }

  private formatTimeValue(value: unknown): string {
    if (!value) {
      return "";
    }
    if (value instanceof Date) {
      const hours = value.getUTCHours();
      const minutes = value.getUTCMinutes();
      const period = hours >= 12 ? "PM" : "AM";
      const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${hour12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
    }

    const stringValue = String(value);
    const match = stringValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);
      const period = hours >= 12 ? "PM" : "AM";
      const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${hour12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
    }

    return stringValue.trim();
  }

  private normalizeName(name: string): string {
    if (!name) {
      return name;
    }

    return name
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(/\b\w+/g, (word) =>
        word.length <= 1
          ? word.toUpperCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      );
  }

  private createResourceAllocationSheet(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
    const worksheet = workbook.addWorksheet("Resource Allocation S26");
    const roomCount = ROOMS.length;

    worksheet.getColumn(1).width = 14;
    for (let index = 0; index < roomCount; index += 1) {
      worksheet.getColumn(index + 2).width = 22;
    }

    const row1 = worksheet.getRow(1);
    row1.getCell(1).value = "S26/Class";
    row1.getCell(1).font = { bold: true, size: 10 };
    row1.height = 40;

    for (let index = 0; index < roomCount; index += 1) {
      const cell = row1.getCell(index + 2);
      cell.value = ROOMS[index].header;
      cell.font = { bold: true, size: 8 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = this.thinBorder();
    }

    const row2 = worksheet.getRow(2);
    row2.getCell(1).value = "Day";
    row2.getCell(1).font = { bold: true, size: 10 };
    row2.height = 30;

    for (let index = 0; index < roomCount; index += 1) {
      const cell = row2.getCell(index + 2);
      cell.value = ROOMS[index].block;
      cell.font = { size: 8 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = this.thinBorder();
    }

    const roomLookup = this.buildRoomLookup(schedules);
    let currentRow = 3;

    for (const day of DAYS) {
      const dayRow = worksheet.getRow(currentRow);
      dayRow.getCell(1).value = day;
      dayRow.getCell(1).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      dayRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };

      for (let index = 0; index < roomCount; index += 1) {
        const cell = dayRow.getCell(index + 2);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
        cell.border = this.thinBorder();
      }

      currentRow += 1;

      for (let timeIndex = 0; timeIndex < TIME_LABELS.length; timeIndex += 1) {
        const timeRow = worksheet.getRow(currentRow);
        timeRow.getCell(1).value = TIME_LABELS[timeIndex];
        timeRow.getCell(1).font = { size: 9 };
        timeRow.getCell(1).border = this.thinBorder();

        for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
          const cell = timeRow.getCell(roomIndex + 2);
          const roomName = ROOMS[roomIndex].name;
          const info = roomLookup[roomName]?.[day]?.[timeIndex];
          if (info) {
            cell.value = `${info.moduleCode} ${info.moduleTitle}`;
            cell.font = { size: 8 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: info.color } };
            cell.alignment = { wrapText: true, vertical: "middle" };
          }
          cell.border = this.thinBorder();
        }

        currentRow += 1;
      }
    }
  }

  private buildRoomLookup(schedules: Schedule[]) {
    const lookup: Record<
      string,
      Record<string, Record<number, { moduleCode: string; moduleTitle: string; color: string }>>
    > = {};
    const moduleColors = this.assignModuleColors(schedules);

    for (const schedule of schedules) {
      const roomKey = this.matchRoom(schedule.room);
      if (!roomKey) {
        continue;
      }

      if (!lookup[roomKey]) {
        lookup[roomKey] = {};
      }
      if (!lookup[roomKey][schedule.day]) {
        lookup[roomKey][schedule.day] = {};
      }

      const startIndex = this.timeToSlotIndex(schedule.startTime);
      const endIndex = this.timeToSlotIndex(schedule.endTime);
      if (startIndex < 0) {
        continue;
      }

      const info = {
        moduleCode: schedule.moduleCode,
        moduleTitle: schedule.moduleTitle,
        color: moduleColors[schedule.moduleCode] || "FFE2EFDA",
      };

      for (let index = startIndex; index < (endIndex >= 0 ? endIndex : startIndex + 3); index += 1) {
        if (index < TIME_LABELS.length) {
          lookup[roomKey][schedule.day][index] = info;
        }
      }
    }

    return lookup;
  }

  private matchRoom(scheduleRoom: string): string | null {
    if (!scheduleRoom) {
      return null;
    }

    const normalized = scheduleRoom.replace(/\s+/g, " ").trim().toLowerCase();
    for (const room of ROOMS) {
      if (room.name.toLowerCase() === normalized) {
        return room.name;
      }
      const prefix = room.name.split(" ")[0].toLowerCase();
      if (normalized.startsWith(prefix)) {
        return room.name;
      }
    }

    return null;
  }

  private timeToSlotIndex(time: string): number {
    const match = time.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
      return -1;
    }

    let hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === "PM" && hours !== 12) {
      hours += 12;
    }
    if (period === "AM" && hours === 12) {
      hours = 0;
    }

    const totalMinutes = hours * 60 + minutes;
    const baseMinutes = 8 * 60;
    const slotIndex = (totalMinutes - baseMinutes) / 30;
    return slotIndex >= 0 && slotIndex < TIME_LABELS.length ? Math.floor(slotIndex) : -1;
  }

  private assignModuleColors(schedules: Schedule[]) {
    const codes = [...new Set(schedules.map((schedule) => schedule.moduleCode))].sort();
    const palette = [
      "FF92D050",
      "FFFFC000",
      "FF00B0F0",
      "FFFF6600",
      "FF7030A0",
      "FFED7D31",
      "FF70AD47",
      "FF4472C4",
      "FFBF8F00",
      "FF00B050",
      "FFFF0000",
      "FF0070C0",
      "FFFFD966",
      "FFA9D18E",
      "FFD9E2F3",
      "FFFCE4D6",
      "FFE2EFDA",
      "FFDAEEF3",
      "FFFFF2CC",
      "FFD6DCE4",
      "FFB4C6E7",
      "FFF8CBAD",
      "FFC6EFCE",
      "FFFFEB9C",
    ];

    const map: Record<string, string> = {};
    codes.forEach((code, index) => {
      map[code] = palette[index % palette.length];
    });

    return map;
  }

  private createModuleViewSheet(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
    const worksheet = workbook.addWorksheet("Module View");
    const headers = [
      "Day",
      "Time Start",
      "Time End",
      "Hours",
      "Class Type",
      "Year",
      "Course",
      "Specialization",
      "Module Code",
      "Module Title",
      "Lecturer",
      "Group",
      "Block",
      "Level",
      "Room",
    ];

    worksheet.columns = [
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 8 },
      { width: 12 },
      { width: 6 },
      { width: 10 },
      { width: 16 },
      { width: 14 },
      { width: 36 },
      { width: 28 },
      { width: 10 },
      { width: 8 },
      { width: 8 },
      { width: 24 },
    ];

    const headerRow = worksheet.getRow(1);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = this.thinBorder();
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const sorted = this.sortSchedules(schedules);
    let row = 2;
    for (const schedule of sorted) {
      const dataRow = worksheet.getRow(row);
      const course =
        schedule.program === "BIT"
          ? "BSc Computing"
          : schedule.program === "BBA"
            ? "BBA"
            : schedule.program;

      const values = [
        schedule.day,
        schedule.startTime,
        schedule.endTime,
        schedule.hours || 1.5,
        schedule.classType,
        schedule.year,
        course,
        schedule.specialization || "",
        schedule.moduleCode,
        schedule.moduleTitle,
        schedule.instructor,
        schedule.group,
        schedule.block,
        schedule.level,
        schedule.room,
      ];

      values.forEach((value, index) => {
        const cell = dataRow.getCell(index + 1);
        cell.value = value;
        cell.font = { size: 10 };
        cell.border = this.thinBorder();
        cell.alignment = { vertical: "middle" };
      });

      row += 1;
    }
  }

  private createWorkloadSheet(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
    const worksheet = workbook.addWorksheet("Workload");
    const headers = [
      "Day",
      "Time Start",
      "Time End",
      "Hours",
      "Class Type",
      "Year",
      "Course",
      "Specialization",
      "Module Code",
      "Module Title",
      "Lecturer",
      "Group",
      "Block",
      "Level",
      "Room",
      "",
      "Lecturer",
    ];

    worksheet.columns = [
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 8 },
      { width: 12 },
      { width: 6 },
      { width: 10 },
      { width: 16 },
      { width: 14 },
      { width: 36 },
      { width: 28 },
      { width: 10 },
      { width: 8 },
      { width: 8 },
      { width: 24 },
      { width: 2 },
      { width: 28 },
    ];

    const headerRow = worksheet.getRow(1);
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = this.thinBorder();
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const sorted = [...schedules].sort((left, right) => {
      const instructorCompare = left.instructor.localeCompare(right.instructor);
      if (instructorCompare !== 0) {
        return instructorCompare;
      }
      const dayDifference = (DAY_ORDER[left.day] ?? 7) - (DAY_ORDER[right.day] ?? 7);
      if (dayDifference !== 0) {
        return dayDifference;
      }
      return left.startTime.localeCompare(right.startTime);
    });

    const instructors = [...new Set(schedules.map((schedule) => schedule.instructor))]
      .filter(Boolean)
      .sort();

    let row = 2;
    for (const schedule of sorted) {
      const dataRow = worksheet.getRow(row);
      const course =
        schedule.program === "BIT"
          ? "BSc Computing"
          : schedule.program === "BBA"
            ? "BBA"
            : schedule.program;

      const values = [
        schedule.day,
        schedule.startTime,
        schedule.endTime,
        schedule.hours || 1.5,
        schedule.classType,
        schedule.year,
        course,
        schedule.specialization || "",
        schedule.moduleCode,
        schedule.moduleTitle,
        schedule.instructor,
        schedule.group,
        schedule.block,
        schedule.level,
        schedule.room,
      ];

      values.forEach((value, index) => {
        const cell = dataRow.getCell(index + 1);
        cell.value = value;
        cell.font = { size: 10 };
        cell.border = this.thinBorder();
        cell.alignment = { vertical: "middle" };
      });

      row += 1;
    }

    for (let index = 0; index < instructors.length; index += 1) {
      worksheet.getRow(index + 2).getCell(17).value = instructors[index];
      worksheet.getRow(index + 2).getCell(17).font = { size: 10 };
    }
  }

  private createProgramSheets(workbook: ExcelJS.Workbook, schedules: Schedule[]) {
    const groups: Record<string, Schedule[]> = {};
    for (const schedule of schedules) {
      const key = `${schedule.program} Y${schedule.year}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(schedule);
    }

    const sheetOrder = ["BIT Y1", "BIT Y2", "BIT Y3", "BBA Y1", "BBA Y2", "BBA Y3"];
    for (const sheetName of sheetOrder) {
      if (!groups[sheetName]) {
        continue;
      }
      this.createSingleProgramSheet(workbook, sheetName, groups[sheetName]);
    }
  }

  private createSingleProgramSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    schedules: Schedule[],
  ) {
    const worksheet = workbook.addWorksheet(sheetName);
    const program = schedules[0]?.program || "";
    const year = schedules[0]?.year || 1;
    const programTitle =
      program === "BIT"
        ? `BSc (Hons) Computing - L${year}B1 TIMETABLE`
        : `BA (Hons) - L${year}B1 TIMETABLE`;

    worksheet.columns = [
      { width: 14 },
      { width: 24 },
      { width: 14 },
      { width: 8 },
      { width: 14 },
      { width: 40 },
      { width: 28 },
      { width: 14 },
      { width: 10 },
      { width: 8 },
      { width: 24 },
    ];

    worksheet.mergeCells(1, 1, 1, 11);
    const universityCell = worksheet.getCell(1, 1);
    universityCell.value = "LONDON METROPOLITAN UNIVERSITY";
    universityCell.font = { bold: true, size: 14 };
    universityCell.alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(2, 1, 2, 11);
    const titleCell = worksheet.getCell(2, 1);
    titleCell.value = programTitle;
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    const headers = [
      "Day",
      "Time",
      "Class Type",
      "Year",
      "Module Code",
      "Module Title",
      "Lecturer",
      "Group",
      "Block",
      "Level",
      "Room",
    ];
    const headerRow = worksheet.getRow(3);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = this.thinBorder();
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const sorted = this.sortSchedules(schedules);
    let row = 4;
    for (const schedule of sorted) {
      const dataRow = worksheet.getRow(row);
      const values = [
        schedule.day,
        `${schedule.startTime} - ${schedule.endTime}`,
        schedule.classType,
        String(schedule.year),
        schedule.moduleCode,
        schedule.moduleTitle,
        schedule.instructor,
        schedule.group,
        schedule.block,
        schedule.level,
        schedule.room,
      ];

      values.forEach((value, index) => {
        const cell = dataRow.getCell(index + 1);
        cell.value = value;
        cell.font = { size: 10 };
        cell.border = this.thinBorder();
        cell.alignment = { vertical: "middle" };
      });

      row += 1;
    }
  }

  private sortSchedules(schedules: Schedule[]) {
    return [...schedules].sort((left, right) => {
      const dayDifference = (DAY_ORDER[left.day] ?? 7) - (DAY_ORDER[right.day] ?? 7);
      if (dayDifference !== 0) {
        return dayDifference;
      }
      return left.startTime.localeCompare(right.startTime);
    });
  }

  private thinBorder(): Partial<ExcelJS.Borders> {
    return {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }
}

async function createImportExportService() {
  const { assignmentRepo, moduleRepo, roomRepo, scheduleRepo } = await getRepositories();
  return new ImportExportService(scheduleRepo, roomRepo, moduleRepo, assignmentRepo);
}

export async function generateExcel() {
  return (await createImportExportService()).generateExcel();
}

export async function importExcel(buffer: Buffer) {
  return (await createImportExportService()).importExcel(buffer);
}

export async function exportCsv() {
  return (await createImportExportService()).exportCsv();
}
