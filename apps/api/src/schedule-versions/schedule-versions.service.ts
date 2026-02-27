import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConflictSeverity, ScheduleVersionStatus } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";

@Injectable()
export class ScheduleVersionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly realtimePublisher: RealtimePublisher,
    private readonly notificationsService: NotificationsService
  ) {}

  async list() {
    return this.prismaService.scheduleVersion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        term: true,
        importJobs: {
          orderBy: { createdAt: "desc" },
          take: 1
        },
        _count: {
          select: {
            weeklySessions: true,
            exceptionSessions: true,
            conflicts: true
          }
        }
      }
    });
  }

  async getIssues(versionId: string) {
    const version = await this.prismaService.scheduleVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException("Schedule version not found");
    }

    return this.prismaService.conflict.findMany({
      where: { versionId },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
    });
  }

  async activate(versionId: string, actorUserId: string) {
    const version = await this.prismaService.scheduleVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException("Schedule version not found");
    }

    const previousActive = await this.prismaService.scheduleVersion.findFirst({
      where: {
        termId: version.termId,
        status: ScheduleVersionStatus.active
      },
      select: {
        id: true
      }
    });

    if (version.status !== ScheduleVersionStatus.validated) {
      throw new BadRequestException("Only validated versions can be activated");
    }

    const blockingCount = await this.prismaService.conflict.count({
      where: { versionId, severity: ConflictSeverity.error }
    });

    if (blockingCount > 0) {
      throw new BadRequestException("Version has blocking conflicts");
    }

    const activated = await this.prismaService.$transaction(async (tx) => {
      await tx.scheduleVersion.updateMany({
        where: { termId: version.termId, status: ScheduleVersionStatus.active },
        data: { status: ScheduleVersionStatus.archived }
      });

      const result = await tx.scheduleVersion.update({
        where: { id: versionId },
        data: {
          status: ScheduleVersionStatus.active,
          activatedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "schedule_version_activated",
          targetType: "schedule_version",
          targetId: versionId,
          metaJson: {
            termId: version.termId
          }
        }
      });

      return result;
    });

    await this.redisService.deleteByPrefix("schedule:active:");
    await this.redisService.deleteByPrefix("rooms:availability:");
    await this.redisService.deleteByPrefix("notifications:user:");

    await this.realtimePublisher.publishSchedule("schedule.activated", {
      versionId: activated.id,
      termId: activated.termId,
      activatedAt: activated.activatedAt?.toISOString() ?? new Date().toISOString()
    });

    await this.realtimePublisher.publishSchedule("board.updated", {
      versionId: activated.id,
      date: new Date().toISOString().slice(0, 10),
      scope: "all"
    });

    await this.realtimePublisher.publishAnalytics("analytics.refreshed", {
      generatedAt: new Date().toISOString()
    });

    await this.notificationsService.notifyVersionActivation({
      versionId: activated.id,
      previousVersionId: previousActive?.id ?? null,
      activatedAt: activated.activatedAt?.toISOString() ?? new Date().toISOString()
    });

    return activated;
  }

  async getActiveVersionId(): Promise<string | null> {
    const active = await this.prismaService.scheduleVersion.findFirst({
      where: { status: ScheduleVersionStatus.active },
      orderBy: { activatedAt: "desc" },
      select: { id: true }
    });

    return active?.id ?? null;
  }
}
