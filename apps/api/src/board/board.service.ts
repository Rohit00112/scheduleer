import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { CACHE_KEYS } from "../common/constants";
import { minuteToTime, normalizeDate, weekdayFromDate } from "../common/utils/time";
import { MappingsService } from "../mappings/mappings.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ScheduleVersionsService } from "../schedule-versions/schedule-versions.service";

interface BoardQuery {
  date?: string;
  scope?: "all" | "mine";
  room?: string;
  course?: string;
  group?: string;
  lecturer?: string;
}

interface SessionShape {
  id: string;
  roomId: string;
  roomName: string;
  startMinute: number;
  endMinute: number;
  classType: string;
  moduleCode: string | null;
  moduleTitle: string | null;
  lecturerId: string | null;
  lecturerName: string | null;
  groupLabels: string[];
  block: string | null;
  level: string | null;
  sourceSheet: string;
  sourceRow: number;
  occurrenceDate: string | null;
  dayType: "weekly" | "exception";
}

function overlaps(a: SessionShape, b: SessionShape): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

function collectIntersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

@Injectable()
export class BoardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly scheduleVersionsService: ScheduleVersionsService,
    private readonly mappingsService: MappingsService
  ) {}

  async weekly(userId: string, query: BoardQuery) {
    const date = normalizeDate(query.date);
    const scope = query.scope === "mine" ? "mine" : "all";

    const filterKey = Buffer.from(
      JSON.stringify({
        scope,
        room: query.room ?? "",
        course: query.course ?? "",
        group: query.group ?? "",
        lecturer: query.lecturer ?? ""
      })
    ).toString("base64url");

    const cacheKey = CACHE_KEYS.board(scope, scope === "mine" ? userId : "all", date, filterKey);
    const cached = await this.redisService.getJson<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const versionId = await this.scheduleVersionsService.getActiveVersionId();
    if (!versionId) {
      throw new NotFoundException("No active schedule version found");
    }

    const weeklyDay = weekdayFromDate(date);
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    const weeklyWhere: Prisma.SessionWeeklyWhereInput = {
      versionId,
      weeklyDay,
      ...(query.room
        ? {
            room: {
              name: {
                contains: query.room,
                mode: "insensitive"
              }
            }
          }
        : {}),
      ...(query.course
        ? {
            module: {
              courseCode: {
                contains: query.course,
                mode: "insensitive"
              }
            }
          }
        : {}),
      ...(query.group
        ? {
            groups: {
              some: {
                group: {
                  label: {
                    contains: query.group,
                    mode: "insensitive"
                  }
                }
              }
            }
          }
        : {}),
      ...(query.lecturer
        ? {
            lecturer: {
              name: {
                contains: query.lecturer,
                mode: "insensitive"
              }
            }
          }
        : {})
    };

    const exceptionWhere: Prisma.SessionExceptionWhereInput = {
      versionId,
      occurrenceDate: dateObj,
      isCancelled: false,
      ...(query.room
        ? {
            room: {
              name: {
                contains: query.room,
                mode: "insensitive"
              }
            }
          }
        : {}),
      ...(query.course
        ? {
            module: {
              courseCode: {
                contains: query.course,
                mode: "insensitive"
              }
            }
          }
        : {}),
      ...(query.lecturer
        ? {
            lecturer: {
              name: {
                contains: query.lecturer,
                mode: "insensitive"
              }
            }
          }
        : {})
    };

    if (scope === "mine") {
      const lecturerScope = await this.mappingsService.resolveLecturerScope(userId);
      Object.assign(weeklyWhere, this.mappingsService.buildLecturerWhere(lecturerScope));
      Object.assign(exceptionWhere, this.mappingsService.buildExceptionLecturerWhere(lecturerScope));
    }

    const [weeklyRows, exceptionRows, activeRooms] = await Promise.all([
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
        },
        orderBy: [{ room: { name: "asc" } }, { startMinute: "asc" }]
      }),
      this.prismaService.sessionException.findMany({
        where: exceptionWhere,
        include: {
          module: true,
          lecturer: true,
          room: true
        },
        orderBy: [{ room: { name: "asc" } }, { startMinute: "asc" }]
      }),
      this.prismaService.room.findMany({
        where: {
          active: true,
          ...(query.room
            ? {
                name: {
                  contains: query.room,
                  mode: "insensitive"
                }
              }
            : {})
        },
        orderBy: { name: "asc" }
      })
    ]);

    const weeklySessions: SessionShape[] = weeklyRows.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      roomName: row.room.name,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      classType: row.classType,
      moduleCode: row.module?.code ?? null,
      moduleTitle: row.module?.title ?? null,
      lecturerId: row.lecturerId,
      lecturerName: row.lecturer?.name ?? null,
      groupLabels: row.groups.map((item) => item.group.label),
      block: row.block,
      level: row.level,
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      occurrenceDate: null,
      dayType: "weekly"
    }));

    const exceptionSessions: SessionShape[] = exceptionRows.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      roomName: row.room.name,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      classType: row.classType,
      moduleCode: row.module?.code ?? null,
      moduleTitle: row.module?.title ?? null,
      lecturerId: row.lecturerId,
      lecturerName: row.lecturer?.name ?? null,
      groupLabels: [],
      block: row.block,
      level: row.level,
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      occurrenceDate: row.occurrenceDate.toISOString().slice(0, 10),
      dayType: "exception"
    }));

    const allSessions = [...weeklySessions, ...exceptionSessions];

    const roomMap = new Map<string, { id: string; name: string; block: string | null; level: string | null }>();
    for (const room of activeRooms) {
      roomMap.set(room.id, {
        id: room.id,
        name: room.name,
        block: room.block,
        level: room.level
      });
    }

    for (const item of allSessions) {
      if (!roomMap.has(item.roomId)) {
        roomMap.set(item.roomId, {
          id: item.roomId,
          name: item.roomName,
          block: item.block,
          level: item.level
        });
      }
    }

    const rooms = Array.from(roomMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const SLOT_MINUTES = 30;
    const earliest = allSessions.length > 0 ? Math.floor(Math.min(...allSessions.map((s) => s.startMinute)) / SLOT_MINUTES) * SLOT_MINUTES : 8 * 60;
    const latestRaw = allSessions.length > 0 ? Math.max(...allSessions.map((s) => s.endMinute)) : 18 * 60;
    const latest = Math.ceil(latestRaw / SLOT_MINUTES) * SLOT_MINUTES;

    const timeslots = [] as Array<{ id: string; startMinute: number; label: string }>;
    for (let minute = earliest; minute <= latest; minute += SLOT_MINUTES) {
      timeslots.push({
        id: `t-${minute}`,
        startMinute: minute,
        label: minuteToTime(minute)
      });
    }

    const roomConflictIds = new Set<string>();
    const lecturerConflictIds = new Set<string>();
    const groupConflictIds = new Set<string>();

    for (let i = 0; i < allSessions.length; i += 1) {
      for (let j = i + 1; j < allSessions.length; j += 1) {
        const left = allSessions[i];
        const right = allSessions[j];

        if (!overlaps(left, right)) {
          continue;
        }

        if (left.roomId === right.roomId) {
          roomConflictIds.add(left.id);
          roomConflictIds.add(right.id);
        }

        if (left.lecturerId && right.lecturerId && left.lecturerId === right.lecturerId) {
          lecturerConflictIds.add(left.id);
          lecturerConflictIds.add(right.id);
        }

        const groupOverlap = collectIntersection(left.groupLabels, right.groupLabels);
        if (groupOverlap.length > 0) {
          groupConflictIds.add(left.id);
          groupConflictIds.add(right.id);
        }
      }
    }

    const cells = allSessions.map((session) => {
      const rowStart = Math.max(0, Math.floor((session.startMinute - earliest) / SLOT_MINUTES));
      const rowSpan = Math.max(1, Math.ceil((session.endMinute - session.startMinute) / SLOT_MINUTES));

      return {
        id: session.id,
        roomId: session.roomId,
        roomName: session.roomName,
        rowStart,
        rowSpan,
        startMinute: session.startMinute,
        endMinute: session.endMinute,
        start: minuteToTime(session.startMinute),
        end: minuteToTime(session.endMinute),
        classType: session.classType,
        moduleCode: session.moduleCode,
        moduleTitle: session.moduleTitle,
        lecturerName: session.lecturerName,
        groups: session.groupLabels,
        block: session.block,
        level: session.level,
        dayType: session.dayType,
        occurrenceDate: session.occurrenceDate,
        sourceSheet: session.sourceSheet,
        sourceRow: session.sourceRow,
        conflictFlags: {
          room: roomConflictIds.has(session.id),
          lecturer: lecturerConflictIds.has(session.id),
          group: groupConflictIds.has(session.id)
        }
      };
    });

    const data = {
      date,
      weeklyDay,
      scope,
      versionId,
      rooms,
      timeslots,
      cells,
      legend: {
        Lecture: "var(--class-lecture)",
        Tutorial: "var(--class-tutorial)",
        Workshop: "var(--class-workshop)",
        Other: "var(--class-other)"
      },
      summary: {
        sessionCount: allSessions.length,
        roomCount: rooms.length,
        timeslotCount: timeslots.length,
        exceptionCount: exceptionSessions.length,
        conflictCount: roomConflictIds.size + lecturerConflictIds.size + groupConflictIds.size
      }
    };

    await this.redisService.setJson(cacheKey, data, 60);
    return data;
  }
}
