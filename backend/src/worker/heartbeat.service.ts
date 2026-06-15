import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisConnectionOptions } from '../config/redis.config';
import { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SEC } from '../health/health.service';

const HEARTBEAT_INTERVAL_MS = 5_000;

/** Writes a periodic heartbeat key to Redis so the API's /system-status can report worker liveness. */
@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Worker');
  private client?: Redis;
  private timer?: NodeJS.Timeout;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const options = getRedisConnectionOptions(this.config);
    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      maxRetriesPerRequest: null,
    });

    this.client.on('error', (err) => this.logger.error(`Heartbeat Redis error: ${err.message}`));

    await this.beat();
    this.timer = setInterval(() => this.beat(), HEARTBEAT_INTERVAL_MS);
  }

  private async beat() {
    try {
      await this.client?.set(WORKER_HEARTBEAT_KEY, Date.now().toString(), 'EX', WORKER_HEARTBEAT_TTL_SEC);
    } catch (err) {
      this.logger.error(`Failed to write heartbeat: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.client?.quit();
  }
}
