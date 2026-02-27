import { Injectable } from "@nestjs/common";
import { ChangeRequest, ChangeRequestType, ScheduleVersionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface ImpactSnapshot {
  riskScore: number;
  blockingIssues: number;
  warningIssues: number;
  summary: Record<string, unknown>;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function utcDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class RequestImpactService {
  constructor(private readonly prismaService: PrismaService) {}

  async evaluate(request: ChangeRequest): Promise<ImpactSnapshot> {
    if (request.type === ChangeRequestType.room_booking) {
      return this.evaluateRoomBooking(request);
    }

    return this.evaluateScheduleChange(request);
  }

  private async evaluateRoomBooking(request: ChangeRequest): Promise<ImpactSnapshot> {
    const payload = this.safePayload(request.payloadJson);
    const roomName = this.readString(payload.roomName);
    const date = this.readString(payload.date);
    const startMinute = this.readNumber(payload.startMinute);
    const endMinute = this.readNumber(payload.endMinute);

    let blockingIssues = 0;
    let warningIssues = 0;

    if (!roomName) {
      blockingIssues += 1;
    }

    if (!date) {
      blockingIssues += 1;
    }

    if (startMinute == null || endMinute == null || endMinute <= startMinute) {
      blockingIssues += 1;
    }

    if (startMinute != null && (startMinute < 0 || startMinute > 1440)) {
      warningIssues += 1;
    }

    if (endMinute != null && (endMinute < 0 || endMinute > 1440)) {
      warningIssues += 1;
    }

    const activeVersion = await this.prismaService.scheduleVersion.findFirst({
      where: {
        status: ScheduleVersionStatus.active
      },
      select: {
        id: true
      }
    });

    if (!activeVersion) {
      warningIssues += 1;
      const riskScore = clampScore(35 + blockingIssues * 30 + warningIssues * 10);
      return {
        riskScore,
        blockingIssues,
        warningIssues,
        summary: {
          reason: "No active schedule version",
          roomName,
          date,
          startMinute,
          endMinute
        }
      };
    }

    const room = roomName
      ? await this.prismaService.room.findFirst({
          where: { name: roomName },
          select: { id: true, name: true }
        })
      : null;

    if (!room) {
      blockingIssues += 1;
    }

    let weeklyConflictCount = 0;
    let exceptionConflictCount = 0;

    if (room && date && startMinute != null && endMinute != null && endMinute > startMinute) {
      const occurrenceDate = utcDateOnly(date);
      const weeklyDay = occurrenceDate.getUTCDay();

      [weeklyConflictCount, exceptionConflictCount] = await Promise.all([
        this.prismaService.sessionWeekly.count({
          where: {
            versionId: activeVersion.id,
            roomId: room.id,
            weeklyDay,
            startMinute: { lt: endMinute },
            endMinute: { gt: startMinute }
          }
        }),
        this.prismaService.sessionException.count({
          where: {
            versionId: activeVersion.id,
            roomId: room.id,
            occurrenceDate,
            isCancelled: false,
            startMinute: { lt: endMinute },
            endMinute: { gt: startMinute }
          }
        })
      ]);

      blockingIssues += weeklyConflictCount + exceptionConflictCount;
    }

    const duration = startMinute != null && endMinute != null ? Math.max(0, endMinute - startMinute) : 0;
    const riskScore = clampScore(
      20 +
        blockingIssues * 26 +
        warningIssues * 9 +
        duration / 10 +
        weeklyConflictCount * 5 +
        exceptionConflictCount * 8
    );

    return {
      riskScore,
      blockingIssues,
      warningIssues,
      summary: {
        requestType: request.type,
        roomName,
        date,
        startMinute,
        endMinute,
        weeklyConflictCount,
        exceptionConflictCount,
        checkedAgainstVersionId: activeVersion.id
      }
    };
  }

  private async evaluateScheduleChange(request: ChangeRequest): Promise<ImpactSnapshot> {
    const payload = this.safePayload(request.payloadJson);
    const effectiveDate = this.readString(payload.effectiveDate);
    const changeItems = Array.isArray(payload.changeItems) ? payload.changeItems : [];

    let blockingIssues = 0;
    let warningIssues = 0;

    if (changeItems.length === 0) {
      warningIssues += 1;
    }

    if (effectiveDate) {
      const effective = utcDateOnly(effectiveDate);
      const leadHours = (effective.getTime() - Date.now()) / (1000 * 60 * 60);
      if (leadHours < 24) {
        blockingIssues += 1;
      } else if (leadHours < 72) {
        warningIssues += 1;
      }
    } else {
      warningIssues += 1;
    }

    const itemComplexity = changeItems.length * 8;
    const riskScore = clampScore(18 + itemComplexity + blockingIssues * 28 + warningIssues * 10);

    return {
      riskScore,
      blockingIssues,
      warningIssues,
      summary: {
        requestType: request.type,
        effectiveDate,
        changeItemCount: changeItems.length
      }
    };
  }

  private safePayload(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
