import type { CaptionPosition, CaptionTheme, CaptionWord } from './types';

export interface CaptionThemePreview {
  id: CaptionTheme;
  label: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  uppercase: boolean;
  wordsPerGroup: number;
}

/** CSS-friendly mirror of backend/src/worker/services/caption.service.ts CAPTION_THEMES, for live preview. */
export const CAPTION_THEME_PREVIEWS: Record<CaptionTheme, CaptionThemePreview> = {
  bold: {
    id: 'bold',
    label: 'Bold (default)',
    fontSize: 84,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFD700',
    uppercase: true,
    wordsPerGroup: 4,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    fontSize: 64,
    primaryColor: '#FFFFFF',
    highlightColor: '#00D0FF',
    uppercase: false,
    wordsPerGroup: 5,
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    fontSize: 90,
    primaryColor: '#FF00FF',
    highlightColor: '#00FFFF',
    uppercase: true,
    wordsPerGroup: 3,
  },
  classic: {
    id: 'classic',
    label: 'Classic',
    fontSize: 60,
    primaryColor: '#FFFF00',
    highlightColor: '#FFFFFF',
    uppercase: false,
    wordsPerGroup: 6,
  },
};

export const CAPTION_POSITIONS: { id: CaptionPosition; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'middle', label: 'Middle' },
  { id: 'bottom', label: 'Bottom' },
];

export const MIN_FONT_SIZE = 24;
export const MAX_FONT_SIZE = 160;

/** Splits words into short "caption page" groups, mirroring the backend's grouping logic. */
export function groupCaptionWords(words: CaptionWord[], wordsPerGroup: number): CaptionWord[][] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  for (const word of words) {
    current.push(word);
    const endsSentence = /[.!?]$/.test(word.word.trim());
    if (current.length >= wordsPerGroup || endsSentence) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

/** Finds the caption group whose word span contains `timeSec` (absolute, source timeline). */
export function findActiveGroup(groups: CaptionWord[][], timeSec: number): { group: CaptionWord[]; activeIndex: number } | null {
  for (const group of groups) {
    if (group.length === 0) continue;
    const start = group[0].start;
    const end = group[group.length - 1].end;
    if (timeSec >= start && timeSec < end) {
      let activeIndex = group.length - 1;
      for (let i = 0; i < group.length; i++) {
        if (timeSec >= group[i].start && timeSec < group[i].end) {
          activeIndex = i;
          break;
        }
      }
      return { group, activeIndex };
    }
  }
  return null;
}
