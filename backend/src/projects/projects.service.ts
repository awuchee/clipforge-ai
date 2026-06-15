import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { extname } from 'path';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { Plan, SourceType, type Clip, type Project } from '@prisma/client';
import { VIDEO_PROCESSING_QUEUE, VideoProcessingJobData } from '../queue/queue.constants';
import { FREE_PLAN_VIDEO_LIMIT, PLAN_LIMIT_REACHED_CODE } from '../billing/billing.constants';

const ALLOWED_MIME_PREFIXES = ['video/', 'audio/'];
const MS_PER_30_DAYS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private videoProcessingQueue: Queue<VideoProcessingJobData>,
  ) {}

  /**
   * Enqueues a project for async processing. Called once a project has a
   * usable source (uploaded file, or a YouTube URL submitted at creation).
   */
  private enqueueProcessing(project: Project) {
    return this.videoProcessingQueue.add(
      'process-video',
      {
        projectId: project.id,
        userId: project.userId,
        videoUrl: project.videoUrl,
        storageKey: project.storageKey,
      },
      { jobId: project.id },
    );
  }

  private readonly quotaExceededError = new ForbiddenException({
    message: `You've reached the ${FREE_PLAN_VIDEO_LIMIT} video/month limit on the Free plan. Upgrade to Pro for unlimited uploads.`,
    code: PLAN_LIMIT_REACHED_CODE,
  });

  /**
   * Enforces the FREE-plan monthly video quota and increments usage on success,
   * atomically. Resets the counter if the user's monthly window has rolled over.
   * PRO/AGENCY plans are unlimited. Throws ForbiddenException with
   * `PLAN_LIMIT_REACHED_CODE` (read by the frontend to show the upgrade modal)
   * when the FREE limit is hit.
   *
   * The check-and-increment is done in a single conditional UPDATE so concurrent
   * requests from the same user can't both pass the check before either write lands.
   */
  private async checkAndConsumeVideoQuota(userId: string): Promise<void> {
    const updated = await this.prisma.$executeRaw`
      UPDATE "users"
      SET
        "videosUsedThisMonth" = CASE
          WHEN now() - "usageResetAt" >= interval '30 days' THEN 1
          ELSE "videosUsedThisMonth" + 1
        END,
        "usageResetAt" = CASE
          WHEN now() - "usageResetAt" >= interval '30 days' THEN now()
          ELSE "usageResetAt"
        END
      WHERE "id" = ${userId}
        AND (
          "plan" != 'FREE'
          OR (CASE WHEN now() - "usageResetAt" >= interval '30 days' THEN 0 ELSE "videosUsedThisMonth" END)
            < ${FREE_PLAN_VIDEO_LIMIT}
        )
    `;

    if (updated === 0) {
      const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) {
        throw new NotFoundException('User not found');
      }
      throw this.quotaExceededError;
    }
  }

  /**
   * Read-only quota check used before creating a PENDING upload project, so
   * FREE users at their limit don't get a project record with no file attached.
   * The authoritative (atomic) check still happens in `attachUpload`.
   */
  private async assertQuotaAvailable(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, videosUsedThisMonth: true, usageResetAt: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.plan !== Plan.FREE) {
      return;
    }

    const rolledOver = Date.now() - user.usageResetAt.getTime() >= MS_PER_30_DAYS;
    const videosUsedThisMonth = rolledOver ? 0 : user.videosUsedThisMonth;
    if (videosUsedThisMonth >= FREE_PLAN_VIDEO_LIMIT) {
      throw this.quotaExceededError;
    }
  }

  /** Attaches public URLs derived from storage keys so the frontend can render/play clips. */
  private mapClip(clip: Clip) {
    return {
      ...clip,
      videoUrl: clip.storageKey ? this.storage.getPublicUrl(clip.storageKey) : null,
      thumbnailUrl: clip.thumbnailKey ? this.storage.getPublicUrl(clip.thumbnailKey) : null,
      srtUrl: clip.srtKey ? this.storage.getPublicUrl(clip.srtKey) : null,
    };
  }

  async findAllForUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { clips: true },
    });

    return projects.map((project) => ({
      ...project,
      clips: project.clips.filter((clip) => clip.status !== 'REJECTED').map((clip) => this.mapClip(clip)),
    }));
  }

  async findOneForUser(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { clips: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException();
    }

    return {
      ...project,
      clips: project.clips.filter((clip) => clip.status !== 'REJECTED').map((clip) => this.mapClip(clip)),
    };
  }

  async create(userId: string, dto: CreateProjectDto) {
    if (dto.sourceType === SourceType.YOUTUBE) {
      await this.checkAndConsumeVideoQuota(userId);
    } else {
      // Upload-type projects consume quota at /upload time (once a file actually
      // exists), but check eagerly here too so FREE users already at their limit
      // don't get a PENDING project with nothing to attach.
      await this.assertQuotaAvailable(userId);
    }

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        sourceType: dto.sourceType,
        sourceUrl: dto.sourceUrl,
        storageKey: dto.storageKey,
        // YouTube projects already have everything needed to be queued for processing;
        // upload projects stay PENDING until a file is attached via /upload.
        status: dto.sourceType === SourceType.YOUTUBE ? 'QUEUED' : 'PENDING',
        userId,
      },
      include: { clips: true },
    });

    if (project.sourceType === SourceType.YOUTUBE) {
      await this.enqueueProcessing(project);
    }

    return project;
  }

  async attachUpload(id: string, userId: string, file: Express.Multer.File) {
    const project = await this.findOneForUser(id, userId);

    if (project.sourceType !== SourceType.UPLOAD_VIDEO && project.sourceType !== SourceType.UPLOAD_AUDIO) {
      throw new BadRequestException('This project does not accept file uploads');
    }

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix))) {
      throw new BadRequestException('File must be a video or audio file');
    }

    try {
      await this.checkAndConsumeVideoQuota(userId);
    } catch (err) {
      // The eager check in create() should normally catch this, but if a FREE
      // user races two uploads and loses here, don't leave behind an empty
      // PENDING project with no source file.
      if (err instanceof ForbiddenException && project.status === 'PENDING') {
        await this.prisma.project.delete({ where: { id: project.id } });
      }
      throw err;
    }

    const ext = extname(file.originalname);
    const key = `projects/${project.id}/source${ext}`;
    const videoUrl = await this.storage.uploadFile(key, file.buffer, file.mimetype);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        videoUrl,
        originalFilename: file.originalname,
        storageKey: key,
        status: 'UPLOADED',
        errorMessage: null,
      },
      include: { clips: true },
    });

    await this.enqueueProcessing(updated);

    return updated;
  }

  async getStatus(id: string, userId: string) {
    const project = await this.findOneForUser(id, userId);
    return {
      id: project.id,
      status: project.status,
      durationSec: project.durationSec,
      errorMessage: project.errorMessage,
      clipCount: project.clips.length,
      updatedAt: project.updatedAt,
    };
  }

  async getClips(id: string, userId: string) {
    await this.findOneForUser(id, userId);
    const clips = await this.prisma.clip.findMany({
      where: { projectId: id, status: { not: 'REJECTED' } },
      orderBy: { viralScore: 'desc' },
    });
    return clips.map((clip) => this.mapClip(clip));
  }
}
