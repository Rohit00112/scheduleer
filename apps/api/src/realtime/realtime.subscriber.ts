import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CHANNELS } from "../common/constants";
import { RedisService } from "../redis/redis.service";
import { RealtimeGateway } from "./realtime.gateway";

interface ChannelMessage {
  event: string;
  payload: unknown;
  room?: string;
}

@Injectable()
export class RealtimeSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeSubscriber.name);
  private subscriber: Redis | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redisService.createSubscriber();
    await this.subscriber.subscribe(
      REDIS_CHANNELS.import,
      REDIS_CHANNELS.schedule,
      REDIS_CHANNELS.rooms,
      REDIS_CHANNELS.notifications,
      REDIS_CHANNELS.analytics
    );

    this.subscriber.on("message", (channel, message) => {
      try {
        const parsed = JSON.parse(message) as ChannelMessage;
        this.realtimeGateway.emit(parsed.event, parsed.payload, parsed.room);
      } catch (error) {
        this.logger.warn(`Failed to parse realtime message on ${channel}: ${(error as Error).message}`);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}
