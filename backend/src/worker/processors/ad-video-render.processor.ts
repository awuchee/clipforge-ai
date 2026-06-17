import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AD_VIDEO_RENDER_QUEUE, AdVideoRenderJobData } from '../../queue/queue.constants';
import { FfmpegService } from '../services/ffmpeg.service';
import { CaptionService, evenlySplitWords } from '../services/caption.service';
import { ThumbnailService } from '../services/thumbnail.service';
import { TextToSpeechService } from '../services/text-to-speech.service';
import type { TranscriptWord } from '../services/transcription.service';
import type { AdVideoPlan } from '../../ads/common/ad-plan.types';

/** Background colors (ffmpeg `0xRRGGBB`) cycled across scenes that have no product image. */
const SCENE_PALETTE = ['0x1a1a2e', '0x16213e', '0x0f3460', '0x533483', '0x222831', '0x393e46'];

/**
 * Consumes `ad-video-render-queue` jobs: turns an `AdProject`'s generated
 * `AdVideoPlan` into a rendered 9:16 video by synthesizing voiceover audio
 * per scene, building per-scene captions, rendering each scene, concatenating
 * them, generating a thumbnail, and uploading the results.
 */
@Processor(AD_VIDEO_RENDER_QUEUE, {
  concurrency: 2,
  lockDuration: 15 * 60 * 1000,
  lockRenewTime: 60 * 1000,
})
export class AdVideoRenderProcessor extends WorkerHost {
  private readonly logger = new Logger(AdVideoRenderProcessor.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
    private ffmpeg: FfmpegService,
    private captions: CaptionService,
    private thumbnail: ThumbnailService,
    private tts: TextToSpeechService,
  ) {
    super();
  }

  async process(job: Job<AdVideoRenderJobData>): Promise<void> {
    const { adProjectId } = job.data;
    this.logger.log(`Rendering ad project ${adProjectId} (job ${job.id})`);

    const adProject = await this.prisma.adProject.findUnique({ where: { id: adProjectId } });
    if (!adProject) {
      throw new NotFoundException(`Ad project ${adProjectId} not found`);
    }
    if (!adProject.plan) {
      throw new Error(`Ad project ${adProjectId} has no generated plan to render`);
    }

    const plan = adProject.plan as unknown as AdVideoPlan;
    const baseTmp = this.config.get<string>('WORKER_TMP_DIR') || tmpdir();
    const workDir = await mkdtemp(join(baseTmp, 'vixclip-ad-'));

    try {
      await this.prisma.adProject.update({
        where: { id: adProjectId },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      const productImages = await this.downloadProductImages(adProject.productImageUrls, workDir);

      const scenes = plan.scenes.length > 0 ? plan.scenes : [];
      if (scenes.length === 0) {
        throw new Error(`Ad project ${adProjectId} plan has no scenes`);
      }

      const sceneVideoPaths: string[] = [];
      const allWords: TranscriptWord[] = [];
      let timelineOffset = 0;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        await job.updateProgress(Math.round((i / scenes.length) * 80));

        const audioPath = join(workDir, `scene-${i}-audio.mp3`);
        await this.tts.synthesize(scene.voiceover, plan.audioDirection.voiceGenderSuggestion, audioPath);
        const sceneDuration = await this.ffmpeg.probeDuration(audioPath);

        const words = evenlySplitWords(scene.voiceover, 0, sceneDuration);
        const assContent = this.captions.buildAss(words, 0, sceneDuration, { themeId: 'bold', position: 'bottom' });
        const assPath = join(workDir, `scene-${i}.ass`);
        await writeFile(assPath, assContent, 'utf-8');

        const textPath = join(workDir, `scene-${i}-text.txt`);
        await writeFile(textPath, scene.onScreenText ?? '', 'utf-8');

        const sceneOutputPath = join(workDir, `scene-${i}.mp4`);
        const backgroundImagePath = productImages.length > 0 ? productImages[i % productImages.length] : undefined;

        await this.ffmpeg.renderAdScene({
          output: sceneOutputPath,
          durationSec: sceneDuration,
          audioPath,
          subtitlesPath: assPath,
          onScreenTextPath: textPath,
          backgroundImagePath,
          paletteColor: SCENE_PALETTE[i % SCENE_PALETTE.length],
        });

        sceneVideoPaths.push(sceneOutputPath);
        for (const word of evenlySplitWords(scene.voiceover, timelineOffset, timelineOffset + sceneDuration)) {
          allWords.push(word);
        }
        timelineOffset += sceneDuration;
      }

      // Concatenate scene videos into the final ad video
      await job.updateProgress(85);
      const finalVideoPath = join(workDir, 'final.mp4');
      await this.ffmpeg.concatVideos(sceneVideoPaths, finalVideoPath);
      const totalDuration = await this.ffmpeg.probeDuration(finalVideoPath);

      // Thumbnail from the first frame, overlaid with the script hook
      await job.updateProgress(90);
      const rawFramePath = join(workDir, 'ad-raw.jpg');
      const thumbnailPath = join(workDir, 'ad-thumb.jpg');
      await this.ffmpeg.generateThumbnail(finalVideoPath, rawFramePath, Math.min(0.5, totalDuration / 2));
      await this.thumbnail.createThumbnail(rawFramePath, plan.script.hook, thumbnailPath);

      // Combined .srt for the full timeline
      const srtContent = this.captions.buildSrt(allWords, 0, timelineOffset);
      const srtPath = join(workDir, 'ad.srt');
      await writeFile(srtPath, srtContent, 'utf-8');

      // Upload outputs
      await job.updateProgress(95);
      const videoKey = `ads/${adProject.id}/ad.mp4`;
      const thumbKey = `ads/${adProject.id}/ad-thumb.jpg`;
      const srtKey = `ads/${adProject.id}/ad.srt`;

      await this.storage.uploadLocalFile(videoKey, finalVideoPath, 'video/mp4');
      await this.storage.uploadLocalFile(thumbKey, thumbnailPath, 'image/jpeg');
      await this.storage.uploadLocalFile(srtKey, srtPath, 'application/x-subrip');

      await this.prisma.adProject.update({
        where: { id: adProjectId },
        data: {
          storageKey: videoKey,
          thumbnailKey: thumbKey,
          srtKey,
          videoUrl: this.storage.getPublicUrl(videoKey),
          durationSec: Math.round(totalDuration),
          status: 'DONE',
          errorMessage: null,
        },
      });

      await job.updateProgress(100);
      this.logger.log(`Finished rendering ad project ${adProjectId}`);
    } catch (err) {
      this.logger.error(`Render failed for ad project ${adProjectId}: ${(err as Error).message}`);
      await this.prisma.adProject.update({
        where: { id: adProjectId },
        data: { status: 'FAILED', errorMessage: (err as Error).message },
      });
      throw err;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  /** Downloads product images for use as scene backgrounds; per-image failures are logged and skipped. */
  private async downloadProductImages(urls: string[], workDir: string): Promise<string[]> {
    const paths: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const response = await fetch(urls[i]);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const imagePath = join(workDir, `product-${i}.jpg`);
        await writeFile(imagePath, buffer);
        paths.push(imagePath);
      } catch (err) {
        this.logger.warn(`Failed to download product image ${urls[i]}: ${(err as Error).message}`);
      }
    }

    return paths;
  }

  /** Fires once a job exhausts all BullMQ retry attempts — surfaced here for log-based alerting. */
  @OnWorkerEvent('failed')
  onFailed(job: Job<AdVideoRenderJobData>, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.error(
        `Job ${job.id} (ad project ${job.data.adProjectId}) failed permanently after ${job.attemptsMade} attempt(s): ${error.message}`,
      );
    }
  }
}
