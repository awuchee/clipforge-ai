import { Module } from '@nestjs/common';
import { ClipsService } from './clips.service';
import { ClipsController } from './clips.controller';
import { ViralMetadataService } from '../worker/services/viral-metadata.service';

@Module({
  providers: [ClipsService, ViralMetadataService],
  controllers: [ClipsController],
})
export class ClipsModule {}
