import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  role: "admin" | "staff" | "viewer";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prismaService: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_ACCESS_SECRET") ?? "replace-this-access-secret"
    });
  }

  async validate(payload: JwtPayload): Promise<{
    id: string;
    email: string;
    role: JwtPayload["role"];
    displayName: string;
    preferredWorkspace: string | null;
    timezone: string | null;
  }> {
    const user = await this.prismaService.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new Error("User not found or inactive");
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      preferredWorkspace: user.preferredWorkspace,
      timezone: user.timezone
    };
  }
}
