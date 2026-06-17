import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AdProject } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AD_VIDEO_RENDER_QUEUE, AdVideoRenderJobData } from '../../queue/queue.constants';
import { AdTemplatesService } from '../ad-templates/ad-templates.service';
import { AdGenerationService } from '../common/ad-generation.service';
import { CreateAdProjectDto } from './dto/create-ad-project.dto';

@Injectable()
export class AdProjectsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private adTemplates: AdTemplatesService,
    private adGeneration: AdGenerationService,
    @InjectQueue(AD_VIDEO_RENDER_QUEUE) private adVideoRenderQueue: Queue<AdVideoRenderJobData>,
  ) {}

  /** Attaches public URLs derived from storage keys so the frontend can render/play the ad. */
  private mapAdProject(adProject: AdProject) {
    return {
      ...adProject,
      videoUrl: adProject.storageKey ? this.storage.getPublicUrl(adProject.storageKey) : adProject.videoUrl,
      thumbnailUrl: adProject.thumbnailKey ? this.storage.getPublicUrl(adProject.thumbnailKey) : null,
      srtUrl: adProject.srtKey ? this.storage.getPublicUrl(adProject.srtKey) : null,
    };
  }

  async create(userId: string, dto: CreateAdProjectDto) {
    const template = this.adTemplates.findOne(dto.templateId);
    if (!template) {
      throw new NotFoundException(`Ad template ${dto.templateId} not found`);
    }

    const adProject = await this.prisma.adProject.create({
      data: {
        templateId: dto.templateId,
        productName: dto.productName,
        productDescription: dto.productDescription,
        targetAudience: dto.targetAudience,
        tone: dto.tone,
        productImageUrls: dto.productImageUrls ?? [],
        status: 'DRAFT',
        userId,
      },
    });

    return this.mapAdProject(adProject);
  }

  async findAllForUser(userId: string) {
    const adProjects = await this.prisma.adProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return adProjects.map((adProject) => this.mapAdProject(adProject));
  }

  async findOneForUser(id: string, userId: string): Promise<AdProject> {
    const adProject = await this.prisma.adProject.findUnique({ where: { id } });

    if (!adProject) {
      throw new NotFoundException('Ad project not found');
    }
    if (adProject.userId !== userId) {
      throw new ForbiddenException();
    }

    return adProject;
  }

  async getOneForUser(id: string, userId: string) {
    return this.mapAdProject(await this.findOneForUser(id, userId));
  }

  /** Generates (or regenerates) the structured `AdVideoPlan` for this ad project via AdGenerationService. */
  async generatePlan(id: string, userId: string) {
    const adProject = await this.findOneForUser(id, userId);

    const plan = await this.adGeneration.generatePlan({
      productName: adProject.productName,
      productDescription: adProject.productDescription,
      targetAudience: adProject.targetAudience ?? undefined,
      tone: adProject.tone ?? undefined,
    });

    const updated = await this.prisma.adProject.update({
      where: { id },
      data: {
        plan: plan as unknown as object,
        status: 'PLAN_READY',
        errorMessage: null,
      },
    });

    return this.mapAdProject(updated);
  }

  /** Validates the ad project has a plan, marks it QUEUED, and enqueues the render job. */
  async enqueueRender(id: string, userId: string) {
    const adProject = await this.findOneForUser(id, userId);

    if (!adProject.plan) {
      throw new BadRequestException('Generate an ad plan before rendering');
    }
    if (adProject.status === 'QUEUED' || adProject.status === 'PROCESSING') {
      throw new BadRequestException('This ad project is already rendering');
    }

    const updated = await this.prisma.adProject.update({
      where: { id },
      data: { status: 'QUEUED', errorMessage: null },
    });

    // A previous attempt may have left a completed/failed job under the same
    // ID; BullMQ silently ignores `add()` for an existing job ID, so remove
    // it first to ensure the render actually re-runs.
    const existingJob = await this.adVideoRenderQueue.getJob(id);
    if (existingJob) {
      await existingJob.remove();
    }

    await this.adVideoRenderQueue.add('render-ad-video', { adProjectId: id }, { jobId: id });

    return this.mapAdProject(updated);
  }

  /** Lightweight polling endpoint for the render status. */
  async getStatus(id: string, userId: string) {
    const adProject = await this.findOneForUser(id, userId);

    return {
      id: adProject.id,
      status: adProject.status,
      errorMessage: adProject.errorMessage,
      videoUrl: adProject.storageKey ? this.storage.getPublicUrl(adProject.storageKey) : null,
      thumbnailUrl: adProject.thumbnailKey ? this.storage.getPublicUrl(adProject.thumbnailKey) : null,
      durationSec: adProject.durationSec,
    };
  }
}
