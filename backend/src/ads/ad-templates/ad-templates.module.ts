import { Module } from '@nestjs/common';
import { AdTemplatesService } from './ad-templates.service';
import { AdTemplatesController } from './ad-templates.controller';

@Module({
  providers: [AdTemplatesService],
  controllers: [AdTemplatesController],
  exports: [AdTemplatesService],
})
export class AdTemplatesModule {}
