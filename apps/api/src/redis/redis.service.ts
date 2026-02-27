import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisUrl: string;
  readonly cache: Redis;
  readonly publisher: Redis;

  constructor(configService: ConfigService) {
    this.redisUrl = configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.cache = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
    this.publisher = new Redis(this.redisUrl, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.cache.quit(), this.publisher.quit()]);
  }

  createSubscriber(): Redis {
    return new Redis(this.redisUrl, { maxRetriesPerRequest: null });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.cache.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await this.cache.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.cache.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    } while (cursor !== "0");
  }

  async publish(channel: string, message: unknown): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }
}
