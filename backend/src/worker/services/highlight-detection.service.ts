import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TranscriptSegment } from './transcription.service';

export interface HighlightWindow {
  start: number;
  end: number;
  text: string;
  score: number;
  reason: string;
  wordCount: number;
}

/** Words/phrases that signal emotional intensity. */
const EMOTIONAL_WORDS = [
  'amazing', 'incredible', 'insane', 'crazy', 'shocking', 'unbelievable', 'secret',
  'never', 'always', 'mistake', 'truth', 'lie', 'wow', 'huge', 'massive', 'best',
  'worst', 'hate', 'love', 'fear', 'afraid', 'angry', 'excited', 'terrible', 'awesome',
  'wild', 'warning', 'mind-blowing', 'life-changing', 'disaster', 'win', 'fail', 'epic',
  'brutal', 'genius', 'scary',
];

/** Phrases commonly used to "hook" viewers in the first seconds of a short. */
const HOOK_KEYWORDS = [
  'how to', 'why', 'what if', 'the truth about', 'nobody tells you', "here's why",
  'number one', 'top', 'mistake', 'secret', 'rule', 'lesson', 'trick', 'hack',
  'story', 'moment', 'realized', 'turns out',
];

const WINDOW_LENGTHS_SEC = [25, 35, 45, 60, 75, 90];
const STEP_SEC = 5;

@Injectable()
export class HighlightDetectionService {
  constructor(private config: ConfigService) {}

  /**
   * Slides candidate windows of varying length across the transcript and
   * scores each one for "viral moment" potential, returning the top
   * non-overlapping windows in chronological order. Candidates with too
   * little spoken content (likely silence/music) are discarded outright.
   */
  detect(segments: TranscriptSegment[], durationSec: number, options?: { min?: number; max?: number }): HighlightWindow[] {
    const min = options?.min ?? 3;
    const max = options?.max ?? 10;
    const minWords = this.config.get<number>('MIN_TRANSCRIPT_WORDS', 8);

    if (durationSec <= 0 || segments.length === 0) {
      return [];
    }

    const candidates: HighlightWindow[] = [];

    for (const length of WINDOW_LENGTHS_SEC) {
      if (length > durationSec) continue;

      for (let start = 0; start + length <= durationSec; start += STEP_SEC) {
        const end = start + length;
        const windowSegments = segments.filter((s) => s.end > start && s.start < end);
        if (windowSegments.length === 0) continue;

        const text = windowSegments.map((s) => s.text.trim()).join(' ').trim();
        if (!text) continue;

        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < minWords) continue;

        const { score, reason } = this.scoreWindow(text, length);
        candidates.push({ start, end, text, score, reason, wordCount });
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    candidates.sort((a, b) => b.score - a.score);

    const selected: HighlightWindow[] = [];
    for (const candidate of candidates) {
      const overlaps = selected.some((sel) => this.overlapRatio(candidate, sel) > 0.4);
      if (!overlaps) {
        selected.push(candidate);
      }
      if (selected.length >= max) break;
    }

    // Backfill with the next-best (even if overlapping) so short videos still
    // produce the minimum number of clips.
    if (selected.length < min) {
      for (const candidate of candidates) {
        if (selected.length >= min) break;
        if (!selected.includes(candidate)) selected.push(candidate);
      }
    }

    return selected.sort((a, b) => a.start - b.start).slice(0, max);
  }

  private overlapRatio(a: HighlightWindow, b: HighlightWindow): number {
    const overlapStart = Math.max(a.start, b.start);
    const overlapEnd = Math.min(a.end, b.end);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    const shorter = Math.min(a.end - a.start, b.end - b.start);
    return shorter === 0 ? 0 : overlap / shorter;
  }

  private scoreWindow(text: string, lengthSec: number): { score: number; reason: string } {
    const lower = text.toLowerCase();
    const wordCount = lower.split(/\s+/).filter(Boolean).length || 1;

    const emotionalHits = EMOTIONAL_WORDS.filter((w) => lower.includes(w)).length;
    const hookHits = HOOK_KEYWORDS.filter((w) => lower.includes(w)).length;
    const exclamations = (text.match(/!/g) ?? []).length;
    const questions = (text.match(/\?/g) ?? []).length;
    const pacing = wordCount / lengthSec; // words per second

    const emotionalScore = Math.min(1, emotionalHits / 4);
    const hookScore = Math.min(1, hookHits / 2);
    const engagementScore = Math.min(1, (exclamations + questions) / 3);
    const pacingScore = Math.min(1, pacing / 2.8);

    const score = emotionalScore * 0.35 + hookScore * 0.3 + engagementScore * 0.15 + pacingScore * 0.2;

    const reasons: string[] = [];
    if (emotionalHits > 0) reasons.push('emotionally charged language');
    if (hookHits > 0) reasons.push('strong hook phrasing');
    if (exclamations + questions > 0) reasons.push('high audience engagement cues');
    if (pacing > 2.2) reasons.push('fast-paced delivery');
    if (reasons.length === 0) reasons.push('clear, self-contained moment');

    return { score, reason: reasons.join(', ') };
  }
}
