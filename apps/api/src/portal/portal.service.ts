import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { normalizeDate, weekdayFromDate } from "../common/utils/time";
import { MappingsService } from "../mappings/mappings.service";
import { PrismaService } from "../prisma/prisma.service";
import { ScheduleVersionsService } from "../schedule-versions/schedule-versions.service";

function formatDateForIcs(date: string, minute: number): string {
  const [year, month, day] = date.split("-");
  const hour = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const minutePart = (minute % 60).toString().padStart(2, "0");
  return `${year}${month}${day}T${hour}${minutePart}00`;
}

function formatStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly scheduleVersionsService: ScheduleVersionsService,
    private readonly mappingsService: MappingsService
  ) {}

  async profile(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        lecturerMappings: {
          include: {
            lecturer: true
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      lecturerAliases: user.lecturerAliases,
      preferredWorkspace: user.preferredWorkspace,
      timezone: user.timezone ?? "Asia/Kathmandu",
      mappings: user.lecturerMappings.map((mapping) => ({
        id: mapping.id,
        lecturerId: mapping.lecturerId,
        lecturerName: mapping.lecturer.name,
        isPrimary: mapping.isPrimary
      }))
    };
  }

  async calendarIcs(userId: string, range: "week" | "month", dateInput?: string): Promise<string> {
    const versionId = await this.scheduleVersionsService.getActiveVersionId();
    if (!versionId) {
      throw new NotFoundException("No active schedule version found");
    }

    const startDate = normalizeDate(dateInput);
    const endDate = range === "month" ? addDays(startDate, 29) : addDays(startDate, 6);
    const days = dateRange(startDate, endDate);
    const dayNumbers = Array.from(new Set(days.map((day) => weekdayFromDate(day))));

    const lecturerScope = await this.mappingsService.resolveLecturerScope(userId);

    const weeklyWhere: Prisma.SessionWeeklyWhereInput = {
      versionId,
      weeklyDay: {
        in: dayNumbers
      },
      ...this.mappingsService.buildLecturerWhere(lecturerScope)
    };

    const exceptionWhere: Prisma.SessionExceptionWhereInput = {
      versionId,
      occurrenceDate: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T00:00:00.000Z`)
      },
      isCancelled: false,
      ...this.mappingsService.buildExceptionLecturerWhere(lecturerScope)
    };

    const [weeklyRows, exceptionRows] = await Promise.all([
      this.prismaService.sessionWeekly.findMany({
        where: weeklyWhere,
        include: {
          module: true,
          lecturer: true,
          room: true,
          groups: {
            include: {
              group: true
            }
          }
        }
      }),
      this.prismaService.sessionException.findMany({
        where: exceptionWhere,
        include: {
          module: true,
          lecturer: true,
          room: true
        }
      })
    ]);

    const weeklyByDay = new Map<number, typeof weeklyRows>();
    for (const row of weeklyRows) {
      const list = weeklyByDay.get(row.weeklyDay) ?? [];
      list.push(row);
      weeklyByDay.set(row.weeklyDay, list);
    }

    const events: string[] = [];
    const dtStamp = formatStamp();

    for (const day of days) {
      const dayNumber = weekdayFromDate(day);
      const rows = weeklyByDay.get(dayNumber) ?? [];

      for (const row of rows) {
        const uid = `weekly-${versionId}-${row.id}-${day}@schedule-hub`;
        const summary = `${row.module?.code ?? "Class"} ${row.classType}`;
        const description = `${row.module?.title ?? ""}\\nLecturer: ${row.lecturer?.name ?? "N/A"}\\nGroups: ${row.groups
          .map((group) => group.group.label)
          .join(", ")}`;

        events.push(
          [
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${dtStamp}`,
            `DTSTART;TZID=Asia/Kathmandu:${formatDateForIcs(day, row.startMinute)}`,
            `DTEND;TZID=Asia/Kathmandu:${formatDateForIcs(day, row.endMinute)}`,
            `SUMMARY:${escapeIcs(summary.trim())}`,
            `DESCRIPTION:${escapeIcs(description.trim())}`,
            `LOCATION:${escapeIcs(row.room.name)}`,
            "END:VEVENT"
          ].join("\r\n")
        );
      }
    }

    for (const row of exceptionRows) {
      const day = row.occurrenceDate.toISOString().slice(0, 10);
      const uid = `exception-${versionId}-${row.id}@schedule-hub`;
      const summary = `${row.module?.code ?? "Class"} ${row.classType}`;
      const description = `${row.module?.title ?? ""}\\nLecturer: ${row.lecturer?.name ?? "N/A"}`;

      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART;TZID=Asia/Kathmandu:${formatDateForIcs(day, row.startMinute)}`,
          `DTEND;TZID=Asia/Kathmandu:${formatDateForIcs(day, row.endMinute)}`,
          `SUMMARY:${escapeIcs(summary.trim())}`,
          `DESCRIPTION:${escapeIcs(description.trim())}`,
          `LOCATION:${escapeIcs(row.room.name)}`,
          "END:VEVENT"
        ].join("\r\n")
      );
    }

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Schedule Hub//Schedule Hub Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Schedule Hub",
      "X-WR-TIMEZONE:Asia/Kathmandu",
      ...events,
      "END:VCALENDAR"
    ].join("\r\n");
  }
}
