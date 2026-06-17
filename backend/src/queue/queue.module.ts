import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { getRedisConnectionOptions } from '../config/redis.config';
import { VIDEO_PROCESSING_QUEUE, CLIP_RENDER_QUEUE, AD_VIDEO_RENDER_QUEUE } from './queue.constants';

/**
 * Global Redis connection + BullMQ queue registration, shared by the API
 * (producer) and the worker process (consumer).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: getRedisConnectionOptions(config),
      }),
    }),
    BullModule.registerQueue({
      name: VIDEO_PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
    BullModule.registerQueue({
      name: CLIP_RENDER_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
    BullModule.registerQueue({
      name: AD_VIDEO_RENDER_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
