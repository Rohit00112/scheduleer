import { BadRequestException, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(payload: CreateUserDto) {
    const existing = await this.prismaService.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new BadRequestException("Email already exists");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    return this.prismaService.user.create({
      data: {
        email: payload.email,
        passwordHash,
        displayName: payload.displayName,
        role: payload.role,
        lecturerAliases: payload.lecturerAliases ?? [],
        preferredWorkspace: payload.preferredWorkspace ?? null,
        timezone: payload.timezone ?? null
      },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        lecturerAliases: true,
        preferredWorkspace: true,
        timezone: true,
        active: true,
        createdAt: true
      }
    });
  }

  async findAll() {
    return this.prismaService.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        lecturerAliases: true,
        preferredWorkspace: true,
        timezone: true,
        active: true,
        createdAt: true
      }
    });
  }
}
