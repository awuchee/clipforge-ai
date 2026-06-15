import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ViralMetadataService } from '../worker/services/viral-metadata.service';
import { CLIP_RENDER_QUEUE, ClipRenderJobData } from '../queue/queue.constants';
import { UpdateClipDto } from './dto/update-clip.dto';
import type { TranscriptWord } from '../worker/services/transcription.service';
import type { Prisma } from '@prisma/client';

const MIN_CLIP_DURATION_SEC = 3;

@Injectable()
export class ClipsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private viralMetadata: ViralMetadataService,
    @InjectQueue(CLIP_RENDER_QUEUE) private renderQueue: Queue<ClipRenderJobData>,
  ) {}

  async findOneForUser(id: string, userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found');
    }

    if (clip.project.userId !== userId) {
      throw new ForbiddenException();
    }

    const { project, ...rest } = clip;
    return {
      ...rest,
      videoUrl: rest.storageKey ? this.storage.getPublicUrl(rest.storageKey) : null,
      thumbnailUrl: rest.thumbnailKey ? this.storage.getPublicUrl(rest.thumbnailKey) : null,
      srtUrl: rest.srtKey ? this.storage.getPublicUrl(rest.srtKey) : null,
    };
  }

  /** Returns a clean, downloadable JSON summary of a clip's generated metadata. */
  async getMetadata(id: string, userId: string) {
    const clip = await this.findOneForUser(id, userId);

    return {
      id: clip.id,
      title: clip.selectedHookTitle ?? clip.hookTitles?.[0] ?? null,
      hookTitles: clip.hookTitles,
      hookVariations: clip.hookVariations,
      selectedHookTitle: clip.selectedHookTitle,
      description: clip.description,
      hashtags: clip.hashtags,
      viralScore: clip.viralScore,
      qualityScore: clip.qualityScore,
      selectionReason: clip.selectionReason,
      platform: clip.platform,
      captionTheme: clip.captionTheme,
      startSec: clip.startSec,
      endSec: clip.endSec,
      durationSec: clip.endSec - clip.startSec,
    };
  }

  /**
   * Applies clip-editor changes (trim, captions, hook selection, etc.) and
   * enqueues a render job so the worker regenerates the affected assets.
   */
  async update(id: string, userId: string, dto: UpdateClipDto) {
    const clip = await this.prisma.clip.findUnique({ where: { id }, include: { project: true } });
    if (!clip) {
      throw new NotFoundException('Clip not found');
    }
    if (clip.project.userId !== userId) {
      throw new ForbiddenException();
    }
    if (clip.status === 'PROCESSING') {
      throw new BadRequestException('Clip is currently rendering, please wait until it finishes');
    }

    const startSec = dto.startSec ?? clip.startSec;
    const endSec = dto.endSec ?? clip.endSec;
    if (endSec - startSec < MIN_CLIP_DURATION_SEC) {
      throw new BadRequestException(`Clip must be at least ${MIN_CLIP_DURATION_SEC}s long`);
    }

    const data: Prisma.ClipUpdateInput = { startSec, endSec, status: 'PROCESSING', errorMessage: null };

    if (dto.captionTheme !== undefined) data.captionTheme = dto.captionTheme;
    if (dto.fontSize !== undefined) data.fontSize = dto.fontSize;
    if (dto.captionPosition !== undefined) data.captionPosition = dto.captionPosition;
    if (dto.emojiEnabled !== undefined) data.emojiEnabled = dto.emojiEnabled;
    if (dto.captionWords !== undefined) data.captionWords = dto.captionWords as unknown as Prisma.InputJsonValue;
    if (dto.hookTitles !== undefined) data.hookTitles = dto.hookTitles;
    if (dto.selectedHookTitle !== undefined) data.selectedHookTitle = dto.selectedHookTitle;

    await this.prisma.clip.update({ where: { id }, data });
    await this.renderQueue.add('render-clip', { clipId: id }, { jobId: `clip-render-${id}-${Date.now()}` });

    return this.findOneForUser(id, userId);
  }

  /** Regenerates the 10 hook title variations for a clip via the viral metadata pipeline. */
  async regenerateHooks(id: string, userId: string) {
    const clip = await this.prisma.clip.findUnique({ where: { id }, include: { project: true } });
    if (!clip) {
      throw new NotFoundException('Clip not found');
    }
    if (clip.project.userId !== userId) {
      throw new ForbiddenException();
    }

    const words = (clip.captionWords as unknown as TranscriptWord[] | null) ?? [];
    const text = words.length > 0 ? words.map((w) => w.word).join(' ') : (clip.description ?? '');

    const heuristicScore = clip.qualityScore ?? (clip.viralScore ?? 50) / 100;
    const metadata = await this.viralMetadata.generate(text, heuristicScore, clip.selectionReason ?? '');

    await this.prisma.clip.update({
      where: { id },
      data: {
        hookTitles: metadata.hookTitles,
        hookVariations: metadata.hookVariations as unknown as Prisma.InputJsonValue,
        selectedHookTitle: metadata.hookTitles[0] ?? clip.selectedHookTitle,
      },
    });

    return this.findOneForUser(id, userId);
  }
}
