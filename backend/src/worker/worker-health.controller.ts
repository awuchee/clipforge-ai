import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE, CLIP_RENDER_QUEUE } from '../queue/queue.constants';

const startedAt = Date.now();

@Controller()
export class WorkerHealthController {
  constructor(
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private videoQueue: Queue,
    @InjectQueue(CLIP_RENDER_QUEUE) private renderQueue: Queue,
  ) {}

  @Get('worker-health')
  async workerHealth() {
    const [videoCounts, renderCounts] = await Promise.all([
      this.videoQueue.getJobCounts(),
      this.renderQueue.getJobCounts(),
    ]);

    return {
      status: 'ok',
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      queues: {
        videoProcessing: { name: VIDEO_PROCESSING_QUEUE, counts: videoCounts },
        clipRender: { name: CLIP_RENDER_QUEUE, counts: renderCounts },
      },
    };
  }
}
