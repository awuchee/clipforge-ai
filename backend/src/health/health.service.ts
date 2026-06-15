import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { getRedisConnectionOptions } from '../config/redis.config';
import { VIDEO_PROCESSING_QUEUE, CLIP_RENDER_QUEUE } from '../queue/queue.constants';

export const WORKER_HEARTBEAT_KEY = 'clipforge:worker:heartbeat';
export const WORKER_HEARTBEAT_TTL_SEC = 30;

export interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger('Health');

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private videoQueue: Queue,
    @InjectQueue(CLIP_RENDER_QUEUE) private renderQueue: Queue,
  ) {}

  async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error(`Database health check failed: ${(err as Error).message}`);
      return { status: 'error', error: (err as Error).message };
    }
  }

  async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    const options = getRedisConnectionOptions(this.config);
    const client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    try {
      await client.connect();
      await client.ping();
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error(`Redis health check failed: ${(err as Error).message}`);
      return { status: 'error', error: (err as Error).message };
    } finally {
      client.disconnect();
    }
  }

  /** Determines whether a worker process is alive by checking for a recent heartbeat key in Redis. */
  async checkWorker(): Promise<CheckResult & { lastHeartbeatMs?: number }> {
    const options = getRedisConnectionOptions(this.config);
    const client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    try {
      await client.connect();
      const value = await client.get(WORKER_HEARTBEAT_KEY);
      if (!value) {
        return { status: 'error', error: 'No worker heartbeat found — worker may not be running' };
      }
      const lastHeartbeatMs = Date.now() - Number(value);
      return { status: 'ok', lastHeartbeatMs };
    } catch (err) {
      return { status: 'error', error: (err as Error).message };
    } finally {
      client.disconnect();
    }
  }

  async getQueueStatus() {
    const [videoCounts, renderCounts] = await Promise.all([
      this.videoQueue.getJobCounts(),
      this.renderQueue.getJobCounts(),
    ]);

    return {
      videoProcessing: { name: VIDEO_PROCESSING_QUEUE, counts: videoCounts },
      clipRender: { name: CLIP_RENDER_QUEUE, counts: renderCounts },
    };
  }

  async getSystemStatus() {
    const [database, redis, worker, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkWorker(),
      this.getQueueStatus(),
    ]);

    const healthy = database.status === 'ok' && redis.status === 'ok' && worker.status === 'ok';

    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database,
      redis,
      worker,
      queues,
    };
  }
}
