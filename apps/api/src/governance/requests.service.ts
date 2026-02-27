import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import {
  ChangeRequestStatus,
  ChangeRequestType,
  Prisma,
  type ChangeRequest
} from "@prisma/client";
import { Queue } from "bullmq";
import { REQUEST_EVALUATION_QUEUE } from "../common/constants";
import type { AuthUser } from "../common/interfaces/auth-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import { GovernanceAuthzService } from "./governance-authz.service";
import { GOVERNANCE_PERMISSIONS } from "./governance.constants";
import type { RequestEvaluationJobPayload } from "./governance.types";
import { CreateRoomBookingRequestDto } from "./dto/create-room-booking-request.dto";
import { CreateScheduleChangeRequestDto } from "./dto/create-schedule-change-request.dto";

const REQUEST_INCLUDE = {
  requestedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true
    }
  },
  submittedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true
    }
  },
  impactSnapshots: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1
  },
  approvalFlow: {
    include: {
      steps: {
        orderBy: {
          stepOrder: "asc"
        },
        include: {
          approverUser: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true
            }
          }
        }
      }
    }
  },
  policyEvaluations: {
    orderBy: {
      createdAt: "desc"
    },
    take: 12,
    include: {
      policy: {
        select: {
          id: true,
          name: true,
          target: true,
          effect: true
        }
      }
    }
  }
} satisfies Prisma.ChangeRequestInclude;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authzService: GovernanceAuthzService,
    private readonly realtimePublisher: RealtimePublisher,
    @InjectQueue(REQUEST_EVALUATION_QUEUE)
    private readonly requestEvaluationQueue: Queue<RequestEvaluationJobPayload>
  ) {}

  async list(
    user: AuthUser,
    query: {
      status?: string;
      type?: string;
    }
  ) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.REQUESTS_VIEW);

    const visibilityWhere = await this.authzService.requestVisibilityWhere(user.id);
    const where: Prisma.ChangeRequestWhereInput = {
      ...visibilityWhere
    };

    if (query.status && Object.values(ChangeRequestStatus).includes(query.status as ChangeRequestStatus)) {
      where.status = query.status as ChangeRequestStatus;
    }

    if (query.type && Object.values(ChangeRequestType).includes(query.type as ChangeRequestType)) {
      where.type = query.type as ChangeRequestType;
    }

    return this.prismaService.changeRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: REQUEST_INCLUDE
    });
  }

  async getById(user: AuthUser, requestId: string) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.REQUESTS_VIEW);

    const visibilityWhere = await this.authzService.requestVisibilityWhere(user.id);
    const request = await this.prismaService.changeRequest.findFirst({
      where: {
        id: requestId,
        ...visibilityWhere
      },
      include: REQUEST_INCLUDE
    });

    if (!request) {
      throw new NotFoundException("Change request not found");
    }

    return request;
  }

  async createScheduleChange(user: AuthUser, payload: CreateScheduleChangeRequestDto) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.REQUESTS_CREATE_SCHEDULE_CHANGE);

    const request = await this.prismaService.changeRequest.create({
      data: {
        type: ChangeRequestType.schedule_change,
        status: ChangeRequestStatus.draft,
        title: payload.title,
        description: payload.description ?? null,
        requestedById: user.id,
        payloadJson: {
          effectiveDate: payload.effectiveDate ?? null,
          changeItems: payload.changeItems ?? [],
          metadata: payload.metadata ?? null
        } as Prisma.InputJsonValue
      },
      include: REQUEST_INCLUDE
    });

    await this.prismaService.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "change_request_created",
        targetType: "change_request",
        targetId: request.id,
        metaJson: {
          type: request.type,
          status: request.status
        }
      }
    });

    await this.realtimePublisher.publishGovernance("request.created", {
      requestId: request.id,
      type: request.type,
      status: request.status,
      requestedById: request.requestedById
    }, "governance");

    return request;
  }

  async createRoomBooking(user: AuthUser, payload: CreateRoomBookingRequestDto) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.REQUESTS_CREATE_ROOM_BOOKING);

    if (payload.endMinute <= payload.startMinute) {
      throw new BadRequestException("End minute must be greater than start minute");
    }

    const request = await this.prismaService.changeRequest.create({
      data: {
        type: ChangeRequestType.room_booking,
        status: ChangeRequestStatus.draft,
        title: payload.title,
        description: payload.description ?? null,
        requestedById: user.id,
        payloadJson: {
          roomName: payload.roomName,
          date: payload.date,
          startMinute: payload.startMinute,
          endMinute: payload.endMinute,
          purpose: payload.purpose ?? null,
          capacityNeeded: payload.capacityNeeded ?? null,
          metadata: payload.metadata ?? null
        } as Prisma.InputJsonValue
      },
      include: REQUEST_INCLUDE
    });

    await this.prismaService.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "change_request_created",
        targetType: "change_request",
        targetId: request.id,
        metaJson: {
          type: request.type,
          status: request.status
        }
      }
    });

    await this.realtimePublisher.publishGovernance("request.created", {
      requestId: request.id,
      type: request.type,
      status: request.status,
      requestedById: request.requestedById
    }, "governance");

    return request;
  }

  async submit(user: AuthUser, requestId: string, note?: string) {
    await this.authzService.requirePermissions(user.id, GOVERNANCE_PERMISSIONS.REQUESTS_SUBMIT);

    const request = await this.prismaService.changeRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      throw new NotFoundException("Change request not found");
    }

    if (request.requestedById !== user.id && user.role !== "admin") {
      throw new ForbiddenException("Only the request owner can submit this request");
    }

    if (request.status !== ChangeRequestStatus.draft) {
      throw new BadRequestException("Only draft requests can be submitted");
    }

    await this.prismaService.changeRequest.update({
      where: { id: requestId },
      data: {
        status: ChangeRequestStatus.submitted,
        submittedById: user.id,
        submittedAt: new Date()
      }
    });

    await this.prismaService.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "change_request_submitted",
        targetType: "change_request",
        targetId: requestId,
        metaJson: {
          note: note ?? null
        }
      }
    });

    await this.requestEvaluationQueue.add(
      REQUEST_EVALUATION_QUEUE,
      {
        requestId,
        submittedByUserId: user.id
      },
      {
        jobId: `${REQUEST_EVALUATION_QUEUE}:${requestId}:${Date.now()}`,
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    await this.realtimePublisher.publishGovernance("request.submitted", {
      requestId,
      status: ChangeRequestStatus.submitted,
      submittedById: user.id
    }, "governance");

    return this.prismaService.changeRequest.findUnique({
      where: { id: requestId },
      include: REQUEST_INCLUDE
    });
  }

  async findOrThrow(requestId: string): Promise<ChangeRequest> {
    const request = await this.prismaService.changeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException("Change request not found");
    }

    return request;
  }
}
