import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_PROCESSING_MS = 30 * 60 * 1000; // 30 minutes
const ORPHAN_PENDING_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Periodically sweeps for abandoned work so it doesn't pile up silently:
 *
 * - Projects/clips stuck in `PROCESSING` for longer than a single job could
 *   reasonably take (worker crashed/restarted mid-job, exhausting BullMQ
 *   retries without ever reaching the processor's own catch block) are marked
 *   `FAILED` so users see an error instead of an endless spinner.
 * - PENDING upload-type projects with no file ever attached (abandoned before
 *   /upload was called) are deleted after 24h.
 */
@Injectable()
export class StaleJobCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('StaleJobCleanup');
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runCleanup(), CLEANUP_INTERVAL_MS);
    void this.runCleanup();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCleanup(): Promise<void> {
    try {
      const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MS);

      const staleProjects = await this.prisma.project.updateMany({
        where: { status: 'PROCESSING', updatedAt: { lt: staleCutoff } },
        data: { status: 'FAILED', errorMessage: 'Processing timed out (worker may have restarted); please retry.' },
      });
      if (staleProjects.count > 0) {
        this.logger.warn(`Marked ${staleProjects.count} stale PROCESSING project(s) as FAILED`);
      }

      const staleClips = await this.prisma.clip.updateMany({
        where: { status: 'PROCESSING', updatedAt: { lt: staleCutoff } },
        data: { status: 'FAILED', errorMessage: 'Rendering timed out (worker may have restarted); please retry.' },
      });
      if (staleClips.count > 0) {
        this.logger.warn(`Marked ${staleClips.count} stale PROCESSING clip(s) as FAILED`);
      }

      const orphanCutoff = new Date(Date.now() - ORPHAN_PENDING_MS);
      const orphans = await this.prisma.project.deleteMany({
        where: { status: 'PENDING', storageKey: null, createdAt: { lt: orphanCutoff } },
      });
      if (orphans.count > 0) {
        this.logger.log(`Deleted ${orphans.count} abandoned PENDING project(s) with no upload after 24h`);
      }
    } catch (err) {
      this.logger.error(`Stale job cleanup failed: ${(err as Error).message}`);
    }
  }
}
