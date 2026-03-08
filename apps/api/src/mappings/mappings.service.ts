import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { normalizeName } from "../common/utils/text";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserLecturerMappingDto } from "./dto/create-user-lecturer-mapping.dto";

export interface LecturerScope {
  mode: "explicit" | "alias";
  lecturerIds: string[];
  aliases: string[];
}

@Injectable()
export class MappingsService {
  constructor(private readonly prismaService: PrismaService) {}

  async list() {
    return this.prismaService.userLecturerMapping.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true
          }
        },
        lecturer: {
          select: {
            id: true,
            name: true,
            normalizedName: true
          }
        }
      },
      orderBy: [{ user: { displayName: "asc" } }, { isPrimary: "desc" }, { createdAt: "desc" }]
    });
  }

  async options() {
    const [users, lecturers] = await Promise.all([
      this.prismaService.user.findMany({
        where: { active: true },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true
        },
        orderBy: { displayName: "asc" }
      }),
      this.prismaService.lecturer.findMany({
        select: {
          id: true,
          name: true,
          normalizedName: true
        },
        orderBy: { name: "asc" }
      })
    ]);

    return { users, lecturers };
  }

  async create(payload: CreateUserLecturerMappingDto) {
    const [user, lecturer] = await Promise.all([
      this.prismaService.user.findUnique({ where: { id: payload.userId } }),
      this.prismaService.lecturer.findUnique({ where: { id: payload.lecturerId } })
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!lecturer) {
      throw new NotFoundException("Lecturer not found");
    }

    const mapping = await this.prismaService.$transaction(async (tx) => {
      if (payload.isPrimary) {
        await tx.userLecturerMapping.updateMany({
          where: { userId: payload.userId },
          data: { isPrimary: false }
        });
      }

      return tx.userLecturerMapping.upsert({
        where: {
          userId_lecturerId: {
            userId: payload.userId,
            lecturerId: payload.lecturerId
          }
        },
        update: {
          isPrimary: payload.isPrimary ?? false
        },
        create: {
          userId: payload.userId,
          lecturerId: payload.lecturerId,
          isPrimary: payload.isPrimary ?? false
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true
            }
          },
          lecturer: {
            select: {
              id: true,
              name: true,
              normalizedName: true
            }
          }
        }
      });
    });

    return mapping;
  }

  async remove(mappingId: string): Promise<{ success: true }> {
    const exists = await this.prismaService.userLecturerMapping.findUnique({ where: { id: mappingId } });
    if (!exists) {
      throw new NotFoundException("Mapping not found");
    }

    await this.prismaService.userLecturerMapping.delete({ where: { id: mappingId } });
    return { success: true };
  }

  async resolveLecturerScope(userId: string): Promise<LecturerScope> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        lecturerMappings: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const explicitLecturerIds = user.lecturerMappings.map((item) => item.lecturerId);
    if (explicitLecturerIds.length > 0) {
      return {
        mode: "explicit",
        lecturerIds: explicitLecturerIds,
        aliases: []
      };
    }

    const aliases = new Set<string>(
      [normalizeName(user.displayName), ...user.lecturerAliases.map((value) => normalizeName(value))]
        .filter((value) => value.length > 0)
    );

    if (aliases.size === 0) {
      throw new BadRequestException("User has no lecturer mapping or aliases");
    }

    return {
      mode: "alias",
      lecturerIds: [],
      aliases: Array.from(aliases)
    };
  }

  buildLecturerWhere(scope: LecturerScope): Prisma.SessionWeeklyWhereInput {
    if (scope.mode === "explicit") {
      return {
        lecturerId: {
          in: scope.lecturerIds
        }
      };
    }

    return {
      lecturer: {
        normalizedName: {
          in: scope.aliases
        }
      }
    };
  }

  buildExceptionLecturerWhere(scope: LecturerScope): Prisma.SessionExceptionWhereInput {
    if (scope.mode === "explicit") {
      return {
        lecturerId: {
          in: scope.lecturerIds
        }
      };
    }

    return {
      lecturer: {
        normalizedName: {
          in: scope.aliases
        }
      }
    };
  }
}
