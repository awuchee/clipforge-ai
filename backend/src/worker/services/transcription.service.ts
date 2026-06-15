import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import OpenAI from 'openai';

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words: TranscriptWord[];
}

export interface TranscriptResult {
  text: string;
  language?: string;
  segments: TranscriptSegment[];
}

interface WhisperVerboseResponse {
  text: string;
  language?: string;
  segments?: Array<{ text: string; start: number; end: number }>;
  words?: Array<{ word: string; start: number; end: number }>;
}

@Injectable()
export class TranscriptionService {
  private readonly client?: OpenAI;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async transcribe(audioPath: string): Promise<TranscriptResult> {
    if (!this.client) {
      throw new Error(
        'OPENAI_API_KEY is not configured; Whisper transcription is required and has no offline fallback',
      );
    }

    const response = await this.client.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    } as never);

    const data = response as unknown as WhisperVerboseResponse;
    const words = data.words ?? [];

    const segments: TranscriptSegment[] = (data.segments ?? []).map((seg) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      words: words.filter((w) => w.start >= seg.start - 0.05 && w.end <= seg.end + 0.05),
    }));

    return { text: data.text, language: data.language, segments };
  }
}
