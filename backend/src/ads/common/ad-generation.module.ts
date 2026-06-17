import { Module } from '@nestjs/common';
import { AdGenerationService } from './ad-generation.service';

@Module({
  providers: [AdGenerationService],
  exports: [AdGenerationService],
})
export class AdGenerationModule {}
