import { Injectable, NotFoundException } from "@nestjs/common";
import { CACHE_KEYS } from "../common/constants";
import { minuteToTime, normalizeDate, parseTimeToMinute, weekdayFromDate } from "../common/utils/time";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import { ScheduleVersionsService } from "../schedule-versions/schedule-versions.service";

@Injectable()
export class RoomsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly scheduleVersionsService: ScheduleVersionsService,
    private readonly realtimePublisher: RealtimePublisher
  ) {}

  listRooms() {
    return this.prismaService.room.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    });
  }

  async availability(dateInput: string | undefined, start: string, end: string) {
    const date = normalizeDate(dateInput);
    const startMinute = parseTimeToMinute(start);
    const endMinute = parseTimeToMinute(end);

    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      throw new NotFoundException("Invalid start/end time query");
    }

    const cacheKey = CACHE_KEYS.roomAvailability(date, start, end);
    const cached = await this.redisService.getJson<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const versionId = await this.scheduleVersionsService.getActiveVersionId();
    if (!versionId) {
      throw new NotFoundException("No active schedule version found");
    }

    const day = weekdayFromDate(date);
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    const [rooms, weeklyConflicts, exceptionConflicts] = await Promise.all([
      this.prismaService.room.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      this.prismaService.sessionWeekly.findMany({
        where: {
          versionId,
          weeklyDay: day,
          startMinute: { lt: endMinute },
          endMinute: { gt: startMinute }
        },
        include: {
          module: true,
          lecturer: true,
          room: true,
          groups: { include: { group: true } }
        }
      }),
      this.prismaService.sessionException.findMany({
        where: {
          versionId,
          occurrenceDate: dateObj,
          isCancelled: false,
          startMinute: { lt: endMinute },
          endMinute: { gt: startMinute }
        },
        include: {
          module: true,
          lecturer: true,
          room: true
        }
      })
    ]);

    const conflictMap = new Map<string, Array<Record<string, unknown>>>();

    for (const row of weeklyConflicts) {
      const existing = conflictMap.get(row.roomId) ?? [];
      existing.push({
        id: row.id,
        source: "weekly",
        start: minuteToTime(row.startMinute),
        end: minuteToTime(row.endMinute),
        classType: row.classType,
        moduleCode: row.module?.code ?? null,
        moduleTitle: row.module?.title ?? null,
        lecturerName: row.lecturer?.name ?? null,
        groups: row.groups.map((item) => item.group.label)
      });
      conflictMap.set(row.roomId, existing);
    }

    for (const row of exceptionConflicts) {
      const existing = conflictMap.get(row.roomId) ?? [];
      existing.push({
        id: row.id,
        source: "exception",
        start: minuteToTime(row.startMinute),
        end: minuteToTime(row.endMinute),
        classType: row.classType,
        moduleCode: row.module?.code ?? null,
        moduleTitle: row.module?.title ?? null,
        lecturerName: row.lecturer?.name ?? null,
        groups: []
      });
      conflictMap.set(row.roomId, existing);
    }

    const response = {
      date,
      start,
      end,
      count: rooms.length,
      items: rooms.map((room) => {
        const conflicts = conflictMap.get(room.id) ?? [];
        return {
          roomId: room.id,
          roomName: room.name,
          isAvailable: conflicts.length === 0,
          conflicts
        };
      })
    };

    await this.redisService.setJson(cacheKey, response, 45);

    for (const item of response.items) {
      await this.realtimePublisher.publishRoom(
        "room.status.updated",
        {
          date,
          roomId: item.roomId,
          busySlots: item.conflicts.map((conflict) => ({
            start: conflict.start,
            end: conflict.end
          })),
          freeSlots: item.isAvailable
            ? [
                {
                  start,
                  end
                }
              ]
            : []
        },
        `rooms:${date}`
      );
    }

    return response;
  }

  async timeline(roomId: string, dateInput?: string) {
    const date = normalizeDate(dateInput);
    const versionId = await this.scheduleVersionsService.getActiveVersionId();
    if (!versionId) {
      throw new NotFoundException("No active schedule version found");
    }

    const day = weekdayFromDate(date);
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    const room = await this.prismaService.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const [weekly, exceptions] = await Promise.all([
      this.prismaService.sessionWeekly.findMany({
        where: {
          versionId,
          roomId,
          weeklyDay: day
        },
        include: {
          module: true,
          lecturer: true,
          groups: {
            include: {
              group: true
            }
          }
        },
        orderBy: { startMinute: "asc" }
      }),
      this.prismaService.sessionException.findMany({
        where: {
          versionId,
          roomId,
          occurrenceDate: dateObj
        },
        include: {
          module: true,
          lecturer: true
        },
        orderBy: { startMinute: "asc" }
      })
    ]);

    return {
      roomId: room.id,
      roomName: room.name,
      date,
      weekly: weekly.map((item) => ({
        id: item.id,
        start: minuteToTime(item.startMinute),
        end: minuteToTime(item.endMinute),
        classType: item.classType,
        moduleCode: item.module?.code ?? null,
        moduleTitle: item.module?.title ?? null,
        lecturerName: item.lecturer?.name ?? null,
        groups: item.groups.map((group) => group.group.label)
      })),
      exceptions: exceptions.map((item) => ({
        id: item.id,
        start: minuteToTime(item.startMinute),
        end: minuteToTime(item.endMinute),
        classType: item.classType,
        moduleCode: item.module?.code ?? null,
        moduleTitle: item.module?.title ?? null,
        lecturerName: item.lecturer?.name ?? null,
        isCancelled: item.isCancelled
      }))
    };
  }
}
