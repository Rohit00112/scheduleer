import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import {
  ConflictSeverity,
  ConflictType,
  ImportJobStatus,
  Prisma,
  ScheduleVersionStatus
} from "@prisma/client";
import { Queue } from "bullmq";
import { parseWorkbook } from "@schedule/parser";
import { IMPORT_SCHEDULE_QUEUE } from "../common/constants";
import { sha256 } from "../common/utils/hash";
import { normalizeName } from "../common/utils/text";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import type { ImportScheduleJobPayload } from "./imports.types";

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly realtimePublisher: RealtimePublisher,
    @InjectQueue(IMPORT_SCHEDULE_QUEUE)
    private readonly importsQueue: Queue<ImportScheduleJobPayload>
  ) {}

  async upload(file: { originalname: string; size: number; buffer: Buffer }, actorUserId: string) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new BadRequestException("Only .xlsx files are supported");
    }

    const checksum = sha256(file.buffer);
    const termName = this.configService.get<string>("DEFAULT_TERM_NAME") ?? "Spring 2026";
    const timezone = this.configService.get<string>("DEFAULT_TIMEZONE") ?? "Asia/Kathmandu";

    const term = await this.prismaService.scheduleTerm.upsert({
      where: { name: termName },
      update: { timezone },
      create: {
        name: termName,
        timezone
      }
    });

    const version = await this.prismaService.scheduleVersion.create({
      data: {
        termId: term.id,
        sourceFileName: file.originalname,
        sourceChecksum: checksum,
        status: ScheduleVersionStatus.draft,
        createdById: actorUserId
      }
    });

    const importJob = await this.prismaService.importJob.create({
      data: {
        versionId: version.id,
        status: ImportJobStatus.queued,
        progress: 0,
        summaryJson: {
          filename: file.originalname,
          size: file.size
        }
      }
    });

    await this.importsQueue.add(
      IMPORT_SCHEDULE_QUEUE,
      {
        importJobId: importJob.id,
        versionId: version.id,
        fileBase64: file.buffer.toString("base64")
      },
      {
        jobId: importJob.id,
        attempts: 2,
        backoff: {
          type: "fixed",
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    await this.realtimePublisher.publishImport("import.progress", {
      importJobId: importJob.id,
      versionId: version.id,
      percent: 0,
      phase: "queued"
    });

    return {
      importJobId: importJob.id,
      versionId: version.id,
      status: importJob.status
    };
  }

  async getImportJob(importJobId: string) {
    const importJob = await this.prismaService.importJob.findUnique({
      where: { id: importJobId },
      include: {
        version: {
          include: {
            _count: {
              select: {
                weeklySessions: true,
                exceptionSessions: true,
                conflicts: true
              }
            }
          }
        }
      }
    });

    if (!importJob) {
      throw new NotFoundException("Import job not found");
    }

    return importJob;
  }

  async processImportJob(payload: ImportScheduleJobPayload): Promise<void> {
    const { importJobId, versionId, fileBase64 } = payload;

    await this.prismaService.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportJobStatus.processing,
        progress: 5,
        startedAt: new Date()
      }
    });

    await this.realtimePublisher.publishImport("import.progress", {
      importJobId,
      versionId,
      percent: 5,
      phase: "parsing"
    }, `import:${importJobId}`);

    try {
      const parseResult = await parseWorkbook(Buffer.from(fileBase64, "base64"));

      await this.realtimePublisher.publishImport(
        "import.progress",
        {
          importJobId,
          versionId,
          percent: 35,
          phase: "normalizing"
        },
        `import:${importJobId}`
      );

      const created = await this.prismaService.$transaction(async (tx) => {
        await tx.sessionGroup.deleteMany({ where: { session: { versionId } } });
        await tx.sessionWeekly.deleteMany({ where: { versionId } });
        await tx.sessionException.deleteMany({ where: { versionId } });
        await tx.conflict.deleteMany({ where: { versionId } });

        let weeklyInserted = 0;
        let exceptionsInserted = 0;

        for (const row of parseResult.weeklySessions) {
          const room = await tx.room.upsert({
            where: { name: row.roomName },
            update: {
              block: row.block ?? undefined,
              level: row.level ?? undefined
            },
            create: {
              name: row.roomName,
              block: row.block,
              level: row.level
            }
          });

          const module = row.moduleCode
            ? await tx.module.upsert({
                where: { code: row.moduleCode },
                update: {
                  title: row.moduleTitle ?? row.moduleCode,
                  courseCode: row.courseCode,
                  yearLevel: row.yearLevel,
                  specialization: row.specialization
                },
                create: {
                  code: row.moduleCode,
                  title: row.moduleTitle ?? row.moduleCode,
                  courseCode: row.courseCode,
                  yearLevel: row.yearLevel,
                  specialization: row.specialization
                }
              })
            : null;

          const lecturer = row.lecturerName
            ? await tx.lecturer.upsert({
                where: { normalizedName: normalizeName(row.lecturerName) },
                update: {
                  name: row.lecturerName
                },
                create: {
                  name: row.lecturerName,
                  normalizedName: normalizeName(row.lecturerName)
                }
              })
            : null;

          const weeklySession = await tx.sessionWeekly.create({
            data: {
              versionId,
              weeklyDay: row.weeklyDay,
              startMinute: row.startMinute,
              endMinute: row.endMinute,
              classType: row.classType,
              moduleId: module?.id,
              lecturerId: lecturer?.id,
              roomId: room.id,
              block: row.block,
              level: row.level,
              sourceSheet: row.sourceSheet,
              sourceRow: row.sourceRow
            }
          });

          for (const token of row.groupTokens) {
            const group = await tx.group.upsert({
              where: { label: token },
              update: {},
              create: { label: token }
            });

            await tx.sessionGroup.create({
              data: {
                sessionId: weeklySession.id,
                groupId: group.id
              }
            });
          }

          weeklyInserted += 1;
        }

        for (const row of parseResult.exceptionSessions) {
          const room = await tx.room.upsert({
            where: { name: row.roomName },
            update: {
              block: row.block ?? undefined,
              level: row.level ?? undefined
            },
            create: {
              name: row.roomName,
              block: row.block,
              level: row.level
            }
          });

          const module = row.moduleCode
            ? await tx.module.upsert({
                where: { code: row.moduleCode },
                update: {
                  title: row.moduleTitle ?? row.moduleCode
                },
                create: {
                  code: row.moduleCode,
                  title: row.moduleTitle ?? row.moduleCode
                }
              })
            : null;

          const lecturer = row.lecturerName
            ? await tx.lecturer.upsert({
                where: { normalizedName: normalizeName(row.lecturerName) },
                update: {
                  name: row.lecturerName
                },
                create: {
                  name: row.lecturerName,
                  normalizedName: normalizeName(row.lecturerName)
                }
              })
            : null;

          await tx.sessionException.create({
            data: {
              versionId,
              occurrenceDate: new Date(`${row.occurrenceDate}T00:00:00.000Z`),
              startMinute: row.startMinute,
              endMinute: row.endMinute,
              classType: row.classType,
              moduleId: module?.id,
              lecturerId: lecturer?.id,
              roomId: room.id,
              block: row.block,
              level: row.level,
              sourceSheet: row.sourceSheet,
              sourceRow: row.sourceRow
            }
          });

          exceptionsInserted += 1;
        }

        const issues = parseResult.issues;
        if (issues.length > 0) {
          await tx.conflict.createMany({
            data: issues.map((issue) => {
              const detailsJson: Prisma.InputJsonValue = issue.details
                ? {
                    message: issue.message,
                    details: issue.details as Prisma.InputJsonValue
                  }
                : {
                    message: issue.message
                  };

              return {
                versionId,
                type: issue.type as ConflictType,
                severity: issue.severity as ConflictSeverity,
                entityKey: issue.entityKey,
                detailsJson,
                sourceSheet: issue.sourceSheet,
                sourceRow: issue.sourceRow
              };
            })
          });
        }

        const blocking = issues.filter((issue) => issue.severity === "error").length;

        const status = blocking > 0 ? ScheduleVersionStatus.draft : ScheduleVersionStatus.validated;
        await tx.scheduleVersion.update({
          where: { id: versionId },
          data: {
            status
          }
        });

        await tx.importJob.update({
          where: { id: importJobId },
          data: {
            status: ImportJobStatus.completed,
            progress: 100,
            finishedAt: new Date(),
            summaryJson: {
              ...parseResult.summary,
              weeklyInserted,
              exceptionsInserted,
              status
            },
            errorJson: Prisma.JsonNull
          }
        });

        return {
          status,
          weeklyInserted,
          exceptionsInserted,
          warningCount: parseResult.summary.warningCount,
          errorCount: parseResult.summary.errorCount
        };
      });

      await this.realtimePublisher.publishImport(
        "import.completed",
        {
          importJobId,
          versionId,
          status: created.status,
          counts: {
            weekly: created.weeklyInserted,
            exceptions: created.exceptionsInserted,
            warnings: created.warningCount,
            errors: created.errorCount
          }
        },
        `import:${importJobId}`
      );

      if (created.warningCount > 0 || created.errorCount > 0) {
        await this.realtimePublisher.publishSchedule("conflict.detected", {
          versionId,
          conflictType: "mixed",
          countDelta: created.warningCount + created.errorCount
        });
      }
    } catch (error) {
      this.logger.error(`Import job failed ${importJobId}: ${(error as Error).message}`, (error as Error).stack);

      await this.prismaService.$transaction(async (tx) => {
        await tx.importJob.update({
          where: { id: importJobId },
          data: {
            status: ImportJobStatus.failed,
            progress: 100,
            finishedAt: new Date(),
            errorJson: {
              message: (error as Error).message
            }
          }
        });

        await tx.scheduleVersion.update({
          where: { id: versionId },
          data: { status: ScheduleVersionStatus.failed }
        });
      });

      await this.realtimePublisher.publishImport(
        "import.failed",
        {
          importJobId,
          versionId,
          message: (error as Error).message
        },
        `import:${importJobId}`
      );
    }
  }
}
