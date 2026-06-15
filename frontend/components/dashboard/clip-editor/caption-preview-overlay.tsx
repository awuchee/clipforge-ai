'use client';

import * as React from 'react';
import { CAPTION_THEME_PREVIEWS, findActiveGroup, groupCaptionWords } from '@/lib/caption-themes';
import type { CaptionPosition, CaptionTheme, CaptionWord } from '@/lib/types';

const POSITION_CLASS: Record<CaptionPosition, string> = {
  top: 'top-[8%]',
  middle: 'top-1/2 -translate-y-1/2',
  bottom: 'bottom-[8%]',
};

/** Renders a Submagic-style live caption overlay for the word at `currentTimeSec` (absolute, source timeline). */
export function CaptionPreviewOverlay({
  words,
  currentTimeSec,
  theme,
  fontSize,
  position,
  emojiEnabled,
}: {
  words: CaptionWord[];
  currentTimeSec: number;
  theme: CaptionTheme;
  fontSize: number;
  position: CaptionPosition;
  emojiEnabled: boolean;
}) {
  const preview = CAPTION_THEME_PREVIEWS[theme];

  const groups = React.useMemo(() => groupCaptionWords(words, preview.wordsPerGroup), [words, preview.wordsPerGroup]);
  const active = React.useMemo(() => findActiveGroup(groups, currentTimeSec), [groups, currentTimeSec]);

  if (!active) return null;

  // Scale the stored fontSize (designed for a 1080px-wide source) down to the preview width.
  const scale = 0.22;
  const scaledFontSize = Math.max(10, fontSize * scale);

  return (
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-3 text-center ${POSITION_CLASS[position]}`}>
      <p
        className="max-w-full font-extrabold leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
        style={{ fontSize: `${scaledFontSize}px`, color: preview.primaryColor, fontFamily: 'Arial, sans-serif' }}
      >
        {active.group.map((word, i) => {
          const display = preview.uppercase ? word.word.toUpperCase() : word.word;
          const isActive = i === active.activeIndex;
          const emoji = isActive && emojiEnabled ? wordEmoji(word.word) : '';
          return (
            <span key={`${word.start}-${i}`} style={isActive ? { color: preview.highlightColor, fontWeight: 900 } : undefined}>
              {display}
              {emoji}
              {i < active.group.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </p>
    </div>
  );
}

const EMOJI_MAP: Record<string, string> = {
  money: ' \u{1F4B0}', cash: ' \u{1F4B0}', win: ' \u{1F3C6}', winning: ' \u{1F3C6}',
  fail: ' \u{274C}', failure: ' \u{274C}', warning: ' \u{26A0}\u{FE0F}', love: ' \u{2764}\u{FE0F}',
  fire: ' \u{1F525}', crazy: ' \u{1F92F}', insane: ' \u{1F92F}', secret: ' \u{1F92B}',
  idea: ' \u{1F4A1}', think: ' \u{1F914}', time: ' \u{23F0}', fast: ' \u{26A1}',
  growth: ' \u{1F4C8}', amazing: ' \u{2728}', truth: ' \u{1F4A3}', scared: ' \u{1F628}', fear: ' \u{1F628}',
};

function wordEmoji(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');
  return EMOJI_MAP[clean] ?? '';
}
