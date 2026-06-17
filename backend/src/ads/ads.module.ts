import { Module } from '@nestjs/common';
import { AdTemplatesModule } from './ad-templates/ad-templates.module';
import { AdScriptsModule } from './ad-scripts/ad-scripts.module';
import { AdProjectsModule } from './ad-projects/ad-projects.module';

/**
 * Ad generation product surface (AI Ad Script Generator, AI Product Ad Video
 * Generator, Ad Templates). Separate from the existing clip-repurposing
 * pipeline (ProjectsModule/ClipsModule/WorkerModule), which is unchanged.
 *
 * See ARCHITECTURE.md for the full design and rollout plan.
 */
@Module({
  imports: [AdTemplatesModule, AdScriptsModule, AdProjectsModule],
})
export class AdsModule {}
