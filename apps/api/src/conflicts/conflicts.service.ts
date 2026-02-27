import { Injectable } from "@nestjs/common";
import { ConflictSeverity, ConflictType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConflictsService {
  constructor(private readonly prismaService: PrismaService) {}

  list(filters: { versionId?: string; type?: string; severity?: string }) {
    return this.prismaService.conflict.findMany({
      where: {
        ...(filters.versionId ? { versionId: filters.versionId } : {}),
        ...(filters.type ? { type: filters.type as ConflictType } : {}),
        ...(filters.severity ? { severity: filters.severity as ConflictSeverity } : {})
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
    });
  }
}
