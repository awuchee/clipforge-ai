import { Module } from '@nestjs/common';
import { AdTemplatesModule } from '../ad-templates/ad-templates.module';
import { AdGenerationModule } from '../common/ad-generation.module';
import { AdProjectsService } from './ad-projects.service';
import { AdProjectsController } from './ad-projects.controller';

@Module({
  imports: [AdTemplatesModule, AdGenerationModule],
  providers: [AdProjectsService],
  controllers: [AdProjectsController],
  exports: [AdProjectsService],
})
export class AdProjectsModule {}
