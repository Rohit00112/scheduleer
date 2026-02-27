import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { AlertsWorkerModule } from "./alerts/alerts-worker.module";
import { ImportsWorkerModule } from "./imports/imports-worker.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { RealtimePublisherModule } from "./realtime/realtime-publisher.module";

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
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnection(configService)
      })
    }),
    PrismaModule,
    RedisModule,
    RealtimePublisherModule,
    AlertsWorkerModule,
    ImportsWorkerModule
  ]
})
export class WorkerAppModule {}
