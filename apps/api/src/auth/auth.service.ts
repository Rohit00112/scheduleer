import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

interface TokenPayload {
  sub: string;
  email: string;
  role: "admin" | "staff" | "viewer";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(payload: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prismaService.user.findUnique({ where: { email: payload.email } });
    if (!user || !user.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(payload.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueTokens({ sub: user.id, email: user.email, role: user.role });
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const secret = this.configService.get<string>("JWT_REFRESH_SECRET") ?? "replace-this-refresh-secret";
      const payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, { secret });
      const user = await this.prismaService.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.active) {
        throw new UnauthorizedException("User is inactive");
      }

      return this.issueTokens({ sub: user.id, email: user.email, role: user.role });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async issueTokens(payload: TokenPayload): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = this.configService.get<string>("JWT_ACCESS_SECRET") ?? "replace-this-access-secret";
    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET") ?? "replace-this-refresh-secret";
    const accessTtl = this.configService.get<string>("JWT_ACCESS_TTL") ?? "15m";
    const refreshTtl = this.configService.get<string>("JWT_REFRESH_TTL") ?? "7d";

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { secret: accessSecret, expiresIn: accessTtl as never }),
      this.jwtService.signAsync(payload, { secret: refreshSecret, expiresIn: refreshTtl as never })
    ]);

    return { accessToken, refreshToken };
  }
}
