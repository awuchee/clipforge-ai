import { Module } from '@nestjs/common';
import { AdTemplatesModule } from '../ad-templates/ad-templates.module';
import { AdGenerationModule } from '../common/ad-generation.module';
import { AdScriptsService } from './ad-scripts.service';
import { AdScriptsController } from './ad-scripts.controller';

@Module({
  imports: [AdTemplatesModule, AdGenerationModule],
  providers: [AdScriptsService],
  controllers: [AdScriptsController],
  exports: [AdScriptsService],
})
export class AdScriptsModule {}
