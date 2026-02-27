import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { AdminModule } from "./admin/admin.module";
import { AlertsModule } from "./alerts/alerts.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { BoardModule } from "./board/board.module";
import { CommonModule } from "./common/common.module";
import { ConflictsModule } from "./conflicts/conflicts.module";
import { ImportsModule } from "./imports/imports.module";
import { MappingsModule } from "./mappings/mappings.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PortalModule } from "./portal/portal.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { RoomsModule } from "./rooms/rooms.module";
import { ScheduleModule } from "./schedule/schedule.module";
import { ScheduleVersionsModule } from "./schedule-versions/schedule-versions.module";
import { UsersModule } from "./users/users.module";

function redisConnection(configService: ConfigService): { host: string; port: number; password?: string } {
  const redisUrl = configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {})
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnection(configService)
      })
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    MappingsModule,
    NotificationsModule,
    AlertsModule,
    ScheduleVersionsModule,
    ImportsModule,
    ScheduleModule,
    BoardModule,
    AdminModule,
    PortalModule,
    RoomsModule,
    ConflictsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
