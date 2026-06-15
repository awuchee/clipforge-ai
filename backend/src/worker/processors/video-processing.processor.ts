import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { VIDEO_PROCESSING_QUEUE, VideoProcessingJobData } from '../../queue/queue.constants';
import { SourceService } from '../services/source.service';
import { FfmpegService } from '../services/ffmpeg.service';
import { TranscriptionService } from '../services/transcription.service';
import { HighlightDetectionService } from '../services/highlight-detection.service';
import { CaptionService, CAPTION_THEMES, DEFAULT_CAPTION_THEME, flattenWords } from '../services/caption.service';
import { ViralMetadataService } from '../services/viral-metadata.service';
import { ThumbnailService } from '../services/thumbnail.service';
import { SmartReframeService } from '../services/smart-reframe.service';

/**
 * Consumes `video-processing-queue` jobs and runs the full pipeline:
 * download -> transcribe -> detect highlights -> render clips (9:16 +
 * burned-in captions) -> generate viral metadata -> upload outputs ->
 * update project/clip status.
 */
@Processor(VIDEO_PROCESSING_QUEUE, {
  concurrency: 2,
  // Video rendering/transcription can take several minutes; a long lock
  // duration (with renewal) keeps BullMQ from marking active jobs as
  // stalled and re-queuing them mid-render.
  lockDuration: 10 * 60 * 1000,
  lockRenewTime: 60 * 1000,
})
export class VideoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
    private source: SourceService,
    private ffmpeg: FfmpegService,
    private transcription: TranscriptionService,
    private highlights: HighlightDetectionService,
    private captions: CaptionService,
    private viralMetadata: ViralMetadataService,
    private thumbnail: ThumbnailService,
    private smartReframe: SmartReframeService,
  ) {
    super();
  }

  async process(job: Job<VideoProcessingJobData>): Promise<void> {
    const { projectId } = job.data;
    this.logger.log(`Starting processing for project ${projectId} (job ${job.id})`);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(`Project ${projectId} not found, skipping job`);
      return;
    }

    const owner = await this.prisma.user.findUnique({ where: { id: project.userId }, select: { plan: true } });
    const watermark = owner?.plan === 'FREE';

    const baseTmp = this.config.get<string>('WORKER_TMP_DIR') || tmpdir();
    const workDir = await mkdtemp(join(baseTmp, 'clipforge-'));

    try {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      // STEP 1: fetch the source video (S3/R2 download or YouTube download)
      await job.updateProgress(5);
      const sourcePath = join(workDir, 'source.mp4');
      await this.source.fetchSource(
        { sourceType: project.sourceType, sourceUrl: project.sourceUrl, storageKey: project.storageKey },
        sourcePath,
      );

      const durationSec = Math.round(await this.ffmpeg.probeDuration(sourcePath));
      const { width: sourceWidth, height: sourceHeight } = await this.ffmpeg.probeDimensions(sourcePath);

      // STEP 2: Whisper transcription
      await job.updateProgress(20);
      const audioPath = join(workDir, 'audio.mp3');
      await this.ffmpeg.extractAudio(sourcePath, audioPath);
      const transcript = await this.transcription.transcribe(audioPath);

      await this.prisma.project.update({
        where: { id: projectId },
        data: { durationSec, transcript: transcript as unknown as object },
      });

      // STEP 3: viral moment detection (sliding-window scoring)
      await job.updateProgress(35);
      const minClips = this.config.get<number>('MIN_CLIPS_PER_VIDEO', 3);
      const maxClips = this.config.get<number>('MAX_CLIPS_PER_VIDEO', 10);
      const windows = this.highlights.detect(transcript.segments, durationSec, { min: minClips, max: maxClips });

      if (windows.length === 0) {
        throw new Error('No viral moments could be detected for this video');
      }

      // Support re-processing: remove any previously-uploaded clip assets and
      // clear stale clip records from a previous run.
      const previousClips = await this.prisma.clip.findMany({ where: { projectId } });
      const staleKeys = previousClips.flatMap((c) => [c.storageKey, c.thumbnailKey, c.srtKey]).filter((k): k is string => !!k);
      if (staleKeys.length > 0) {
        await this.storage.deleteFiles(staleKeys);
      }
      await this.prisma.clip.deleteMany({ where: { projectId } });

      for (let i = 0; i < windows.length; i++) {
        const window = windows[i];
        await job.updateProgress(35 + Math.round(((i + 1) / windows.length) * 60));

        const clip = await this.prisma.clip.create({
          data: { projectId, startSec: window.start, endSec: window.end, status: 'PROCESSING' },
        });

        try {
          await this.renderAndPublishClip(
            clip.id,
            projectId,
            sourcePath,
            transcript.segments,
            window,
            workDir,
            i,
            sourceWidth,
            sourceHeight,
            watermark,
          );
        } catch (err) {
          this.logger.error(`Clip ${i} failed for project ${projectId}: ${(err as Error).message}`);
          await this.prisma.clip.update({
            where: { id: clip.id },
            data: { status: 'FAILED', errorMessage: (err as Error).message },
          });
        }
      }

      // STEP 8: finalize project status
      await job.updateProgress(100);
      await this.prisma.project.update({ where: { id: projectId }, data: { status: 'DONE' } });
      this.logger.log(`Finished processing project ${projectId}: ${windows.length} clips generated`);
    } catch (err) {
      this.logger.error(`Processing failed for project ${projectId}: ${(err as Error).message}`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED', errorMessage: (err as Error).message },
      });
      throw err;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  /** Fires once a job exhausts all BullMQ retry attempts — surfaced here for log-based alerting. */
  @OnWorkerEvent('failed')
  onFailed(job: Job<VideoProcessingJobData>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.error(
        `Job ${job.id} (project ${job.data.projectId}) failed permanently after ${job.attemptsMade} attempt(s): ${error.message}`,
      );
    }
  }

  private async renderAndPublishClip(
    clipId: string,
    projectId: string,
    sourcePath: string,
    segments: import('../services/transcription.service').TranscriptSegment[],
    window: import('../services/highlight-detection.service').HighlightWindow,
    workDir: string,
    index: number,
    sourceWidth: number,
    sourceHeight: number,
    watermark: boolean,
  ): Promise<void> {
    // STEP 6: viral metadata (hook titles, hashtags, description, score, reason)
    // Generated up front so the quality filter can reject weak clips before
    // any rendering/encoding work is spent on them.
    const metadata = await this.viralMetadata.generate(window.text, window.score, window.reason);
    const qualityScore = Math.round(window.score * 100) / 100;

    const minViralScore = this.config.get<number>('MIN_VIRAL_SCORE', 35);
    const minQualityScore = this.config.get<number>('MIN_QUALITY_SCORE', 0.15);

    if (metadata.viralScore < minViralScore || qualityScore < minQualityScore) {
      this.logger.log(
        `Rejecting clip ${index} for project ${projectId}: viralScore=${metadata.viralScore} qualityScore=${qualityScore}`,
      );
      await this.prisma.clip.update({
        where: { id: clipId },
        data: {
          viralScore: metadata.viralScore,
          qualityScore,
          selectionReason: `Below quality threshold (viral=${metadata.viralScore}, quality=${qualityScore.toFixed(2)})`,
          status: 'REJECTED',
        },
      });
      return;
    }

    // STEP 5: generate word-by-word captions (SRT export + burned-in ASS)
    const themeIds = Object.keys(CAPTION_THEMES);
    const captionTheme = this.config.get<string>('CAPTION_THEME') || themeIds[index % themeIds.length] || DEFAULT_CAPTION_THEME;

    const captionWords = flattenWords(segments, window.start, window.end);
    const srtContent = this.captions.buildSrt(captionWords, window.start, window.end);
    const assContent = this.captions.buildAss(captionWords, window.start, window.end, { themeId: captionTheme });
    const srtPath = join(workDir, `clip-${index}.srt`);
    const assPath = join(workDir, `clip-${index}.ass`);
    await writeFile(srtPath, srtContent, 'utf-8');
    await writeFile(assPath, assContent, 'utf-8');

    // STEP 4: cut + reframe to 9:16 (smart pan if motion is detected, else center-crop) with burned-in captions
    const reframeWorkDir = join(workDir, `clip-${index}-reframe`);
    const cropPlan = await this.smartReframe.computeCropPlan(
      sourcePath,
      window.start,
      window.end - window.start,
      sourceWidth,
      sourceHeight,
      reframeWorkDir,
    );

    const clipOutputPath = join(workDir, `clip-${index}.mp4`);
    await this.ffmpeg.renderClip(
      sourcePath,
      clipOutputPath,
      window.start,
      window.end - window.start,
      assPath,
      cropPlan ?? undefined,
      watermark,
    );

    // STEP 3: extract the strongest frame and overlay the hook text
    const rawFramePath = join(workDir, `clip-${index}-raw.jpg`);
    const thumbnailPath = join(workDir, `clip-${index}-thumb.jpg`);
    const smartAtSec = Math.min(window.end - window.start - 0.1, Math.max(0.1, (window.end - window.start) * 0.3));
    await this.ffmpeg.generateThumbnail(clipOutputPath, rawFramePath, smartAtSec);
    await this.thumbnail.createThumbnail(rawFramePath, metadata.hookTitles[0] ?? window.text, thumbnailPath);

    // STEP 7: upload outputs to S3/R2 and persist the clip record
    const clipKey = `projects/${projectId}/clips/${clipId}.mp4`;
    const thumbKey = `projects/${projectId}/clips/${clipId}-thumb.jpg`;
    const srtKey = `projects/${projectId}/clips/${clipId}.srt`;

    await this.storage.uploadLocalFile(clipKey, clipOutputPath, 'video/mp4');
    await this.storage.uploadLocalFile(thumbKey, thumbnailPath, 'image/jpeg');
    await this.storage.uploadLocalFile(srtKey, srtPath, 'application/x-subrip');

    await this.prisma.clip.update({
      where: { id: clipId },
      data: {
        storageKey: clipKey,
        thumbnailKey: thumbKey,
        srtKey,
        hookTitles: metadata.hookTitles,
        hookVariations: metadata.hookVariations as unknown as object,
        selectedHookTitle: metadata.hookTitles[0] ?? null,
        description: metadata.description,
        hashtags: metadata.hashtags,
        viralScore: metadata.viralScore,
        qualityScore,
        selectionReason: metadata.selectionReason,
        platform: metadata.platform,
        captionTheme,
        captionWords: captionWords as unknown as object,
        status: 'DONE',
        errorMessage: null,
      },
    });
  }
}
