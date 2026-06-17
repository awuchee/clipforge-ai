import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'fs/promises';
import OpenAI from 'openai';
import { PiperTtsService } from './piper-tts.service';

/** Maps the plan's `audioDirection.voiceGenderSuggestion` to an OpenAI TTS voice. */
const VOICE_BY_GENDER: Record<string, string> = {
  male: 'onyx',
  female: 'nova',
  either: 'alloy',
  neutral: 'alloy',
};

/**
 * Synthesizes ad voiceover audio. Uses OpenAI's TTS API when `OPENAI_API_KEY`
 * is configured (primary, highest quality). When it is not configured, falls
 * back to local, offline, zero-cost synthesis via `PiperTtsService` so the
 * render pipeline can still produce a complete ad video.
 */
@Injectable()
export class TextToSpeechService {
  private readonly logger = new Logger(TextToSpeechService.name);
  private readonly client?: OpenAI;

  constructor(
    private config: ConfigService,
    private piper: PiperTtsService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async synthesize(text: string, voiceGenderSuggestion: string, outputPath: string): Promise<void> {
    if (this.client) {
      const voice = VOICE_BY_GENDER[voiceGenderSuggestion?.toLowerCase()?.trim()] ?? 'alloy';

      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: voice as 'alloy' | 'onyx' | 'nova',
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(outputPath, buffer);
      return;
    }

    this.logger.warn('OPENAI_API_KEY is not configured; using local Piper TTS fallback for ad voiceover.');
    await this.piper.synthesize(text, voiceGenderSuggestion, outputPath);
  }
}
