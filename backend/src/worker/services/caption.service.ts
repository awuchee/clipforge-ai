import { Injectable } from '@nestjs/common';
import type { TranscriptSegment, TranscriptWord } from './transcription.service';

/** Words that get speaker-emphasis styling (bold + highlight) when active. */
const EMPHASIS_WORDS = new Set([
  'amazing', 'incredible', 'insane', 'crazy', 'shocking', 'unbelievable', 'secret', 'never',
  'always', 'mistake', 'truth', 'huge', 'massive', 'best', 'worst', 'love', 'hate', 'wow',
  'free', 'now', 'win', 'fail', 'epic', 'genius', 'warning', 'money', 'success', 'failure',
  'stop', 'literally', 'actually', 'seriously',
]);

/** Emoji appended after the active word when it matches a keyword. */
const EMOJI_MAP: Record<string, string> = {
  money: ' \u{1F4B0}',
  cash: ' \u{1F4B0}',
  win: ' \u{1F3C6}',
  winning: ' \u{1F3C6}',
  fail: ' \u{274C}',
  failure: ' \u{274C}',
  warning: ' \u{26A0}\u{FE0F}',
  love: ' \u{2764}\u{FE0F}',
  fire: ' \u{1F525}',
  crazy: ' \u{1F92F}',
  insane: ' \u{1F92F}',
  secret: ' \u{1F92B}',
  idea: ' \u{1F4A1}',
  think: ' \u{1F914}',
  time: ' \u{23F0}',
  fast: ' \u{26A1}',
  growth: ' \u{1F4C8}',
  amazing: ' \u{2728}',
  truth: ' \u{1F4A3}',
  scared: ' \u{1F628}',
  fear: ' \u{1F628}',
};

export type CaptionPosition = 'top' | 'middle' | 'bottom';

export interface CaptionTheme {
  /** Stable identifier stored on the Clip record (`captionTheme`). */
  id: string;
  label: string;
  fontName: string;
  fontSize: number;
  /** ASS colors in &HAABBGGRR / &HBBGGRR format. */
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  marginV: number;
  /** Max words shown together as one caption "page". */
  wordsPerGroup: number;
  /** Roughly when to wrap onto a second line, in characters. */
  maxLineChars: number;
  uppercase: boolean;
}

export interface CaptionOptions {
  themeId?: string;
  /** Overrides the theme's default font size. */
  fontSize?: number;
  /** Vertical placement of the caption block. Defaults to 'bottom'. */
  position?: CaptionPosition;
  /** Whether to append emoji after emphasis/keyword words. Defaults to true. */
  emojiEnabled?: boolean;
}

/** Reusable Submagic-style caption templates. */
export const CAPTION_THEMES: Record<string, CaptionTheme> = {
  bold: {
    id: 'bold',
    label: 'Bold (default)',
    fontName: 'Arial',
    fontSize: 84,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H0000D7FF', // gold
    outlineColor: '&H00000000',
    outline: 5,
    shadow: 0,
    marginV: 260,
    wordsPerGroup: 4,
    maxLineChars: 24,
    uppercase: true,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    fontName: 'Arial',
    fontSize: 64,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H00FFD000', // cyan
    outlineColor: '&H00000000',
    outline: 2,
    shadow: 0,
    marginV: 180,
    wordsPerGroup: 5,
    maxLineChars: 32,
    uppercase: false,
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    fontName: 'Arial',
    fontSize: 90,
    primaryColor: '&H00FF00FF', // magenta
    highlightColor: '&H00FFFF00', // cyan
    outlineColor: '&H00000000',
    outline: 6,
    shadow: 2,
    marginV: 280,
    wordsPerGroup: 3,
    maxLineChars: 20,
    uppercase: true,
  },
  classic: {
    id: 'classic',
    label: 'Classic',
    fontName: 'Arial',
    fontSize: 60,
    primaryColor: '&H0000FFFF', // yellow
    highlightColor: '&H00FFFFFF', // white
    outlineColor: '&H00000000',
    outline: 3,
    shadow: 0,
    marginV: 160,
    wordsPerGroup: 6,
    maxLineChars: 40,
    uppercase: false,
  },
};

export const DEFAULT_CAPTION_THEME = 'bold';

/** ASS `Alignment` values for the V4+ style (numpad-style: 1-3 bottom, 4-6 middle, 7-9 top). */
const ALIGNMENT_BY_POSITION: Record<CaptionPosition, number> = {
  bottom: 2,
  middle: 5,
  top: 8,
};

/** Returns word-level timings for a segment, falling back to an even split across the segment. */
export function resolveWords(segment: TranscriptSegment): TranscriptWord[] {
  if (segment.words && segment.words.length > 0) {
    return segment.words;
  }

  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const span = (segment.end - segment.start) / words.length;
  return words.map((word, i) => ({
    word,
    start: segment.start + i * span,
    end: segment.start + (i + 1) * span,
  }));
}

/** Flattens segments into a word list, keeping only words inside [clipStart, clipEnd). */
export function flattenWords(segments: TranscriptSegment[], clipStart: number, clipEnd: number): TranscriptWord[] {
  const words: TranscriptWord[] = [];

  for (const segment of segments) {
    if (segment.end <= clipStart || segment.start >= clipEnd) continue;
    for (const word of resolveWords(segment)) {
      if (word.end > clipStart && word.start < clipEnd) {
        words.push(word);
      }
    }
  }

  return words;
}

/** Evenly distributes the words of `text` across [startSec, endSec), used to synthesize word timings for TTS audio. */
export function evenlySplitWords(text: string, startSec: number, endSec: number): TranscriptWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const span = (endSec - startSec) / words.length;
  return words.map((word, i) => ({
    word,
    start: startSec + i * span,
    end: startSec + (i + 1) * span,
  }));
}

@Injectable()
export class CaptionService {
  /** Builds a standard .srt subtitle file with times relative to the clip start. */
  buildSrt(words: TranscriptWord[], clipStart: number, clipEnd: number): string {
    const theme = CAPTION_THEMES[DEFAULT_CAPTION_THEME];
    const groups = this.groupWords(words.filter((w) => w.end > clipStart && w.start < clipEnd), theme);

    const lines: string[] = [];
    let index = 1;

    for (const group of groups) {
      if (group.length === 0) continue;
      const start = Math.max(group[0].start, clipStart) - clipStart;
      const end = Math.min(group[group.length - 1].end, clipEnd) - clipStart;
      const text = group.map((w) => w.word).join(' ').trim();
      if (!text) continue;

      lines.push(String(index++));
      lines.push(`${formatSrtTime(start)} --> ${formatSrtTime(end)}`);
      lines.push(text);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Builds an .ass subtitle track with word-by-word active-word highlighting
   * ("Submagic style"): words are grouped into short lines, each shown for the
   * full group duration, with the currently-spoken word highlighted in color
   * (and bold + emoji for emphasis words).
   */
  buildAss(words: TranscriptWord[], clipStart: number, clipEnd: number, options: CaptionOptions = {}): string {
    const baseTheme = CAPTION_THEMES[options.themeId ?? DEFAULT_CAPTION_THEME] ?? CAPTION_THEMES[DEFAULT_CAPTION_THEME];
    const position = options.position ?? 'bottom';
    const emojiEnabled = options.emojiEnabled ?? true;
    const theme: CaptionTheme = options.fontSize ? { ...baseTheme, fontSize: options.fontSize } : baseTheme;
    const alignment = ALIGNMENT_BY_POSITION[position];

    const header = [
      '[Script Info]',
      'ScriptType: v4.00+',
      'PlayResX: 1080',
      'PlayResY: 1920',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: Default,${theme.fontName},${theme.fontSize},${theme.primaryColor},&H000000FF,${theme.outlineColor},&H00000000,1,0,0,0,100,100,0,0,1,${theme.outline},${theme.shadow},${alignment},60,60,${theme.marginV},1`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ];

    const relevantWords = words.filter((w) => w.end > clipStart && w.start < clipEnd);
    const groups = this.groupWords(relevantWords, theme);
    const dialogues: string[] = [];

    for (const group of groups) {
      for (let i = 0; i < group.length; i++) {
        const word = group[i];
        const start = Math.max(word.start, clipStart) - clipStart;
        const end = Math.max(start + 0.05, Math.min(word.end, clipEnd) - clipStart);
        const text = this.renderGroupText(group, i, theme, emojiEnabled);
        dialogues.push(`Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${text}`);
      }
    }

    return [...header, ...dialogues].join('\n');
  }

  /** Splits words into short "caption page" groups, breaking early at sentence punctuation. */
  private groupWords(words: TranscriptWord[], theme: CaptionTheme): TranscriptWord[][] {
    const groups: TranscriptWord[][] = [];
    let current: TranscriptWord[] = [];

    for (const word of words) {
      current.push(word);
      const endsSentence = /[.!?]$/.test(word.word.trim());
      if (current.length >= theme.wordsPerGroup || endsSentence) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);

    return groups;
  }

  /** Renders a caption group with the active word highlighted, with automatic line breaking. */
  private renderGroupText(group: TranscriptWord[], activeIndex: number, theme: CaptionTheme, emojiEnabled: boolean): string {
    const tokens = group.map((word, i) => {
      const display = theme.uppercase ? word.word.toUpperCase() : word.word;
      const isActive = i === activeIndex;
      const emoji = isActive && emojiEnabled ? this.emojiFor(word.word) : '';
      const escaped = escapeAssText(display + emoji);

      if (!isActive) return escaped;

      const emphasis = this.isEmphasisWord(word.word);
      const open = emphasis ? '{\\b1}' : '';
      const close = emphasis ? '{\\b0}' : '';
      return `{\\c${theme.highlightColor}}${open}${escaped}${close}{\\c${theme.primaryColor}}`;
    });

    const plainLength = group
      .map((w) => (theme.uppercase ? w.word.toUpperCase() : w.word))
      .join(' ').length;

    let body: string;
    if (plainLength > theme.maxLineChars && tokens.length > 1) {
      const mid = Math.ceil(tokens.length / 2);
      body = `${tokens.slice(0, mid).join(' ')}\\N${tokens.slice(mid).join(' ')}`;
    } else {
      body = tokens.join(' ');
    }

    return `{\\c${theme.primaryColor}}${body}`;
  }

  private isEmphasisWord(word: string): boolean {
    const clean = word.toLowerCase().replace(/[^a-z']/g, '');
    return EMPHASIS_WORDS.has(clean) || (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) || word.includes('!');
  }

  private emojiFor(word: string): string {
    const clean = word.toLowerCase().replace(/[^a-z']/g, '');
    return EMOJI_MAP[clean] ?? '';
  }
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

function formatSrtTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function formatAssTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.round((clamped - Math.floor(clamped)) * 100);
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0');
}
