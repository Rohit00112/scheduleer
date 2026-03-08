import { Injectable } from "@nestjs/common";
import { ImportJobStatus, ScheduleVersionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ScheduleVersionsService } from "../schedule-versions/schedule-versions.service";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly scheduleVersionsService: ScheduleVersionsService
  ) {}

  async overview() {
    const activeVersionId = await this.scheduleVersionsService.getActiveVersionId();

    const [versionsTotal, draftVersions, validatedVersions, roomsActive, conflictsOpen, queuedImports, processingImports, mappedUsers] =
      await Promise.all([
        this.prismaService.scheduleVersion.count(),
        this.prismaService.scheduleVersion.count({ where: { status: ScheduleVersionStatus.draft } }),
        this.prismaService.scheduleVersion.count({ where: { status: ScheduleVersionStatus.validated } }),
        this.prismaService.room.count({ where: { active: true } }),
        this.prismaService.conflict.count({ where: { resolved: false } }),
        this.prismaService.importJob.count({ where: { status: ImportJobStatus.queued } }),
        this.prismaService.importJob.count({ where: { status: ImportJobStatus.processing } }),
        this.prismaService.userLecturerMapping.count()
      ]);

    return {
      activeVersionId,
      versionsTotal,
      draftVersions,
      validatedVersions,
      roomsActive,
      conflictsOpen,
      queuedImports,
      processingImports,
      mappedUsers,
      generatedAt: new Date().toISOString()
    };
  }

  async lecturerAnalytics(from?: string, to?: string) {
    const versionId = await this.scheduleVersionsService.getActiveVersionId();
    if (!versionId) {
      return {
        versionId: null,
        from: from ?? null,
        to: to ?? null,
        items: []
      };
    }

    const sessions = await this.prismaService.sessionWeekly.findMany({
      where: { versionId },
      include: {
        lecturer: true
      }
    });

    const byLecturer = new Map<
      string,
      {
        lecturerId: string;
        lecturerName: string;
        totalMinutes: number;
        sessionCount: number;
        classTypeCounts: Record<string, number>;
        startBuckets: Record<string, number>;
      }
    >();

    for (const session of sessions) {
      if (!session.lecturerId || !session.lecturer) {
        continue;
      }

      const key = session.lecturerId;
      const entry = byLecturer.get(key) ?? {
        lecturerId: session.lecturerId,
        lecturerName: session.lecturer.name,
        totalMinutes: 0,
        sessionCount: 0,
        classTypeCounts: {},
        startBuckets: {}
      };

      const duration = Math.max(0, session.endMinute - session.startMinute);
      entry.totalMinutes += duration;
      entry.sessionCount += 1;
      entry.classTypeCounts[session.classType] = (entry.classTypeCounts[session.classType] ?? 0) + 1;

      const bucket = `${Math.floor(session.startMinute / 60)
        .toString()
        .padStart(2, "0")}:00`;
      entry.startBuckets[bucket] = (entry.startBuckets[bucket] ?? 0) + 1;

      byLecturer.set(key, entry);
    }

    const items = Array.from(byLecturer.values())
      .map((entry) => {
        const peakWindow = Object.entries(entry.startBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return {
          lecturerId: entry.lecturerId,
          lecturerName: entry.lecturerName,
          sessionCount: entry.sessionCount,
          totalHours: round(entry.totalMinutes / 60),
          classTypeDistribution: entry.classTypeCounts,
          peakWindow
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);

    return {
      versionId,
      from: from ?? null,
      to: to ?? null,
      items
    };
  }

  async roomAnalytics(from?: string, to?: string) {
    const versionId = await this.scheduleVersionsService.getActiveVersionId();
    if (!versionId) {
      return {
        versionId: null,
        from: from ?? null,
        to: to ?? null,
        items: []
      };
    }

    const sessions = await this.prismaService.sessionWeekly.findMany({
      where: { versionId },
      include: {
        room: true
      }
    });

    const totalWindowMinutes = 7 * 10 * 60;

    const byRoom = new Map<
      string,
      {
        roomId: string;
        roomName: string;
        block: string | null;
        level: string | null;
        totalMinutes: number;
        sessionCount: number;
      }
    >();

    for (const session of sessions) {
      const key = session.roomId;
      const entry = byRoom.get(key) ?? {
        roomId: session.roomId,
        roomName: session.room.name,
        block: session.room.block,
        level: session.room.level,
        totalMinutes: 0,
        sessionCount: 0
      };

      entry.totalMinutes += Math.max(0, session.endMinute - session.startMinute);
      entry.sessionCount += 1;
      byRoom.set(key, entry);
    }

    const items = Array.from(byRoom.values())
      .map((entry) => ({
        roomId: entry.roomId,
        roomName: entry.roomName,
        block: entry.block,
        level: entry.level,
        sessionCount: entry.sessionCount,
        occupiedHours: round(entry.totalMinutes / 60),
        occupancyRate: round((entry.totalMinutes / totalWindowMinutes) * 100),
        idleHours: round(Math.max(0, totalWindowMinutes - entry.totalMinutes) / 60)
      }))
      .sort((a, b) => b.occupancyRate - a.occupancyRate);

    return {
      versionId,
      from: from ?? null,
      to: to ?? null,
      items
    };
  }
}
