import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CACHE_KEYS } from "../common/constants";
import { minuteToTime, normalizeDate, parseTimeToMinute, weekdayFromDate } from "../common/utils/time";
import { MappingsService } from "../mappings/mappings.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ScheduleVersionsService } from "../schedule-versions/schedule-versions.service";

function mapWeeklySession(session: {
  id: string;
  weeklyDay: number;
  startMinute: number;
  endMinute: number;
  classType: string;
  block: string | null;
  level: string | null;
  module: { code: string; title: string } | null;
  lecturer: { name: string } | null;
  room: { name: string };
  groups: { group: { label: string } }[];
}) {
  return {
    id: session.id,
    weeklyDay: session.weeklyDay,
    startMinute: session.startMinute,
    endMinute: session.endMinute,
    start: minuteToTime(session.startMinute),
    end: minuteToTime(session.endMinute),
    classType: session.classType,
    moduleCode: session.module?.code ?? null,
    moduleTitle: session.module?.title ?? null,
    lecturerName: session.lecturer?.name ?? null,
    roomName: session.room.name,
    block: session.block,
    level: session.level,
    groups: session.groups.map((item) => item.group.label)
  };
}

function mapExceptionSession(session: {
  id: string;
  occurrenceDate: Date;
  startMinute: number;
  endMinute: number;
  classType: string;
  block: string | null;
  level: string | null;
  module: { code: string; title: string } | null;
  lecturer: { name: string } | null;
  room: { name: string };
}) {
  return {
    id: session.id,
    date: session.occurrenceDate.toISOString().slice(0, 10),
    startMinute: session.startMinute,
    endMinute: session.endMinute,
    start: minuteToTime(session.startMinute),
    end: minuteToTime(session.endMinute),
    classType: session.classType,
    moduleCode: session.module?.code ?? null,
    moduleTitle: session.module?.title ?? null,
    lecturerName: session.lecturer?.name ?? null,
    roomName: session.room.name,
    block: session.block,
    level: session.level,
    groups: [] as string[]
  };
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly versionsService: ScheduleVersionsService,
    private readonly mappingsService: MappingsService
  ) {}

  async mySchedule(userId: string, dateInput?: string) {
    const date = normalizeDate(dateInput);
    const cacheKey = CACHE_KEYS.mySchedule(userId, date);
    const cached = await this.redisService.getJson<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const versionId = await this.versionsService.getActiveVersionId();
    if (!versionId) {
      throw new NotFoundException("No active schedule version found");
    }

    const lecturerScope = await this.mappingsService.resolveLecturerScope(userId);

    const weeklyDay = weekdayFromDate(date);

    const weeklySessions = await this.prismaService.sessionWeekly.findMany({
      where: {
        versionId,
        weeklyDay,
        ...this.mappingsService.buildLecturerWhere(lecturerScope)
      },
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
      orderBy: { startMinute: "asc" }
    });

    const exceptionSessions = await this.prismaService.sessionException.findMany({
      where: {
        versionId,
        occurrenceDate: new Date(`${date}T00:00:00.000Z`),
        isCancelled: false,
        ...this.mappingsService.buildExceptionLecturerWhere(lecturerScope)
      },
      include: {
        module: true,
        lecturer: true,
        room: true
      },
      orderBy: { startMinute: "asc" }
    });

    const data = {
      date,
      versionId,
      weekly: weeklySessions.map(mapWeeklySession),
      exceptions: exceptionSessions.map(mapExceptionSession)
    };

    await this.redisService.setJson(cacheKey, data, 60);
    return data;
  }

  async search(query: {
    day?: string;
    start?: string;
    end?: string;
    room?: string;
    lecturer?: string;
    group?: string;
    course?: string;
  }) {
    const hashKey = Buffer.from(JSON.stringify(query)).toString("base64url");
    const cacheKey = CACHE_KEYS.search(hashKey);

    const cached = await this.redisService.getJson<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const versionId = await this.versionsService.getActiveVersionId();
    if (!versionId) {
      throw new NotFoundException("No active schedule version found");
    }

    let weeklyDay: number | undefined;
    if (query.day) {
      const lower = query.day.trim().toLowerCase();
      const map: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
      };
      weeklyDay = map[lower] ?? Number(lower);
    }

    const startMinute = query.start ? parseTimeToMinute(query.start) : null;
    const endMinute = query.end ? parseTimeToMinute(query.end) : null;

    const where: Prisma.SessionWeeklyWhereInput = {
      versionId,
      ...(Number.isInteger(weeklyDay) ? { weeklyDay } : {}),
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
      ...(query.lecturer
        ? {
            lecturer: {
              name: {
                contains: query.lecturer,
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
      ...(startMinute !== null && endMinute !== null
        ? {
            startMinute: { gte: startMinute },
            endMinute: { lte: endMinute }
          }
        : {})
    };

    const rows = await this.prismaService.sessionWeekly.findMany({
      where,
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
      orderBy: [{ weeklyDay: "asc" }, { startMinute: "asc" }]
    });

    const data = {
      versionId,
      count: rows.length,
      items: rows.map(mapWeeklySession)
    };

    await this.redisService.setJson(cacheKey, data, 60);
    return data;
  }
}
