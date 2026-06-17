import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CLIP_RENDER_QUEUE, ClipRenderJobData } from '../../queue/queue.constants';
import { SourceService } from '../services/source.service';
import { FfmpegService } from '../services/ffmpeg.service';
import { CaptionService, CaptionPosition, DEFAULT_CAPTION_THEME } from '../services/caption.service';
import { ThumbnailService } from '../services/thumbnail.service';
import { SmartReframeService } from '../services/smart-reframe.service';
import type { TranscriptWord } from '../services/transcription.service';

/**
 * Consumes `clip-render-queue` jobs: re-renders a single clip's video,
 * captions, thumbnail, and .srt after the user edits trim, caption, or hook
 * settings in the clip editor.
 */
@Processor(CLIP_RENDER_QUEUE, {
  concurrency: 2,
  lockDuration: 10 * 60 * 1000,
  lockRenewTime: 60 * 1000,
})
export class ClipRenderProcessor extends WorkerHost {
  private readonly logger = new Logger(ClipRenderProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
    private source: SourceService,
    private ffmpeg: FfmpegService,
    private captions: CaptionService,
    private thumbnail: ThumbnailService,
    private smartReframe: SmartReframeService,
  ) {
    super();
  }

  async process(job: Job<ClipRenderJobData>): Promise<void> {
    const { clipId } = job.data;
    this.logger.log(`Re-rendering clip ${clipId} (job ${job.id})`);

    const clip = await this.prisma.clip.findUnique({ where: { id: clipId }, include: { project: true } });
    if (!clip) {
      throw new NotFoundException(`Clip ${clipId} not found`);
    }

    const owner = await this.prisma.user.findUnique({ where: { id: clip.project.userId }, select: { plan: true } });
    const watermark = owner?.plan === 'FREE';

    const baseTmp = this.config.get<string>('WORKER_TMP_DIR') || tmpdir();
    const workDir = await mkdtemp(join(baseTmp, 'vixclip-render-'));

    try {
      await this.prisma.clip.update({ where: { id: clipId }, data: { status: 'PROCESSING', errorMessage: null } });

      // STEP 1: fetch the source video
      await job.updateProgress(10);
      const sourcePath = join(workDir, 'source.mp4');
      await this.source.fetchSource(
        {
          sourceType: clip.project.sourceType,
          sourceUrl: clip.project.sourceUrl,
          storageKey: clip.project.storageKey,
        },
        sourcePath,
      );
      const { width: sourceWidth, height: sourceHeight } = await this.ffmpeg.probeDimensions(sourcePath);

      // STEP 2: build captions from the (possibly edited) word list and settings
      await job.updateProgress(30);
      const words = (clip.captionWords as unknown as TranscriptWord[] | null) ?? [];
      const srtContent = this.captions.buildSrt(words, clip.startSec, clip.endSec);
      const assContent = this.captions.buildAss(words, clip.startSec, clip.endSec, {
        themeId: clip.captionTheme ?? DEFAULT_CAPTION_THEME,
        fontSize: clip.fontSize ?? undefined,
        position: (clip.captionPosition as CaptionPosition | null) ?? 'bottom',
        emojiEnabled: clip.emojiEnabled,
      });
      const srtPath = join(workDir, 'clip.srt');
      const assPath = join(workDir, 'clip.ass');
      await writeFile(srtPath, srtContent, 'utf-8');
      await writeFile(assPath, assContent, 'utf-8');

      // STEP 3: cut + reframe with the (possibly trimmed) start/end
      await job.updateProgress(45);
      const reframeWorkDir = join(workDir, 'reframe');
      const cropPlan = await this.smartReframe.computeCropPlan(
        sourcePath,
        clip.startSec,
        clip.endSec - clip.startSec,
        sourceWidth,
        sourceHeight,
        reframeWorkDir,
      );

      const clipOutputPath = join(workDir, 'clip.mp4');
      await this.ffmpeg.renderClip(
        sourcePath,
        clipOutputPath,
        clip.startSec,
        clip.endSec - clip.startSec,
        assPath,
        cropPlan ?? undefined,
        watermark,
      );

      // STEP 4: regenerate the thumbnail using the currently-selected hook title
      await job.updateProgress(75);
      const rawFramePath = join(workDir, 'clip-raw.jpg');
      const thumbnailPath = join(workDir, 'clip-thumb.jpg');
      const durationSec = clip.endSec - clip.startSec;
      const smartAtSec = Math.min(durationSec - 0.1, Math.max(0.1, durationSec * 0.3));
      await this.ffmpeg.generateThumbnail(clipOutputPath, rawFramePath, smartAtSec);

      const hookText = clip.selectedHookTitle ?? clip.hookTitles[0] ?? '';
      await this.thumbnail.createThumbnail(rawFramePath, hookText, thumbnailPath);

      // STEP 5: upload outputs (overwriting the previous versions) and persist the clip record
      await job.updateProgress(90);
      const clipKey = clip.storageKey ?? `projects/${clip.projectId}/clips/${clip.id}.mp4`;
      const thumbKey = clip.thumbnailKey ?? `projects/${clip.projectId}/clips/${clip.id}-thumb.jpg`;
      const srtKey = clip.srtKey ?? `projects/${clip.projectId}/clips/${clip.id}.srt`;

      await this.storage.uploadLocalFile(clipKey, clipOutputPath, 'video/mp4');
      await this.storage.uploadLocalFile(thumbKey, thumbnailPath, 'image/jpeg');
      await this.storage.uploadLocalFile(srtKey, srtPath, 'application/x-subrip');

      await this.prisma.clip.update({
        where: { id: clipId },
        data: {
          storageKey: clipKey,
          thumbnailKey: thumbKey,
          srtKey,
          status: 'DONE',
          errorMessage: null,
        },
      });

      await job.updateProgress(100);
      this.logger.log(`Finished re-rendering clip ${clipId}`);
    } catch (err) {
      this.logger.error(`Re-render failed for clip ${clipId}: ${(err as Error).message}`);
      await this.prisma.clip.update({
        where: { id: clipId },
        data: { status: 'FAILED', errorMessage: (err as Error).message },
      });
      throw err;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  /** Fires once a job exhausts all BullMQ retry attempts — surfaced here for log-based alerting. */
  @OnWorkerEvent('failed')
  onFailed(job: Job<ClipRenderJobData>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.error(
        `Job ${job.id} (clip ${job.data.clipId}) failed permanently after ${job.attemptsMade} attempt(s): ${error.message}`,
      );
    }
  }
}
