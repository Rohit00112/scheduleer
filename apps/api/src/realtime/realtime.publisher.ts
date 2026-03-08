import { Injectable } from "@nestjs/common";
import { REDIS_CHANNELS } from "../common/constants";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class RealtimePublisher {
  constructor(private readonly redisService: RedisService) {}

  async publishImport(event: string, payload: unknown, room?: string): Promise<void> {
    await this.redisService.publish(REDIS_CHANNELS.import, { event, payload, room });
  }

  async publishSchedule(event: string, payload: unknown, room?: string): Promise<void> {
    await this.redisService.publish(REDIS_CHANNELS.schedule, { event, payload, room });
  }

  async publishRoom(event: string, payload: unknown, room?: string): Promise<void> {
    await this.redisService.publish(REDIS_CHANNELS.rooms, { event, payload, room });
  }

  async publishNotification(event: string, payload: unknown, room?: string): Promise<void> {
    await this.redisService.publish(REDIS_CHANNELS.notifications, { event, payload, room });
  }

  async publishAnalytics(event: string, payload: unknown, room?: string): Promise<void> {
    await this.redisService.publish(REDIS_CHANNELS.analytics, { event, payload, room });
  }
}
