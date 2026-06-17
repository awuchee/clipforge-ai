import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { VideoProcessingProcessor } from './processors/video-processing.processor';
import { ClipRenderProcessor } from './processors/clip-render.processor';
import { AdVideoRenderProcessor } from './processors/ad-video-render.processor';
import { SourceService } from './services/source.service';
import { FfmpegService } from './services/ffmpeg.service';
import { TranscriptionService } from './services/transcription.service';
import { TextToSpeechService } from './services/text-to-speech.service';
import { PiperTtsService } from './services/piper-tts.service';
import { HighlightDetectionService } from './services/highlight-detection.service';
import { CaptionService } from './services/caption.service';
import { ViralMetadataService } from './services/viral-metadata.service';
import { ThumbnailService } from './services/thumbnail.service';
import { SmartReframeService } from './services/smart-reframe.service';
import { HeartbeatService } from './heartbeat.service';
import { StaleJobCleanupService } from './stale-job-cleanup.service';
import { WorkerHealthController } from './worker-health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), PrismaModule, StorageModule, QueueModule],
  controllers: [WorkerHealthController],
  providers: [
    VideoProcessingProcessor,
    ClipRenderProcessor,
    AdVideoRenderProcessor,
    SourceService,
    FfmpegService,
    TranscriptionService,
    TextToSpeechService,
    PiperTtsService,
    HighlightDetectionService,
    CaptionService,
    ViralMetadataService,
    ThumbnailService,
    SmartReframeService,
    HeartbeatService,
    StaleJobCleanupService,
  ],
})
export class WorkerModule {}
