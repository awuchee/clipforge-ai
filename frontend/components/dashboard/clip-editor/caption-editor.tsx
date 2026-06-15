'use client';

import * as React from 'react';
import { Captions, Smile, SmilePlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CAPTION_POSITIONS, CAPTION_THEME_PREVIEWS, MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/lib/caption-themes';
import type { CaptionPosition, CaptionTheme, CaptionWord } from '@/lib/types';

export function CaptionEditor({
  words,
  theme,
  fontSize,
  position,
  emojiEnabled,
  onWordsChange,
  onThemeChange,
  onFontSizeChange,
  onPositionChange,
  onEmojiToggle,
}: {
  words: CaptionWord[];
  theme: CaptionTheme;
  fontSize: number;
  position: CaptionPosition;
  emojiEnabled: boolean;
  onWordsChange: (words: CaptionWord[]) => void;
  onThemeChange: (theme: CaptionTheme) => void;
  onFontSizeChange: (size: number) => void;
  onPositionChange: (position: CaptionPosition) => void;
  onEmojiToggle: (enabled: boolean) => void;
}) {
  const handleWordTextChange = (index: number, text: string) => {
    const next = words.slice();
    next[index] = { ...next[index], word: text };
    onWordsChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Captions className="h-4 w-4" />
          Captions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CAPTION_THEME_PREVIEWS) as CaptionTheme[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onThemeChange(id)}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    theme === id ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent'
                  }`}
                >
                  <span className="font-medium" style={{ color: CAPTION_THEME_PREVIEWS[id].highlightColor }}>
                    {CAPTION_THEME_PREVIEWS[id].label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Position</label>
            <div className="flex gap-2">
              {CAPTION_POSITIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPositionChange(opt.id)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs transition-colors ${
                    position === opt.id ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Font size: {fontSize}px</label>
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Emojis</label>
            <Button
              type="button"
              variant={emojiEnabled ? 'default' : 'outline'}
              size="sm"
              className="w-full gap-1.5"
              onClick={() => onEmojiToggle(!emojiEnabled)}
            >
              {emojiEnabled ? <SmilePlus className="h-4 w-4" /> : <Smile className="h-4 w-4" />}
              {emojiEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Caption words ({words.length})
          </label>
          {words.length === 0 ? (
            <p className="text-sm text-muted-foreground">No captions available for this clip.</p>
          ) : (
            <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border bg-secondary/30 p-2">
              {words.map((word, i) => (
                <Input
                  key={i}
                  value={word.word}
                  onChange={(e) => handleWordTextChange(i, e.target.value)}
                  className="h-8 w-auto min-w-[3.5rem] flex-none rounded-md border-border bg-background px-2 text-center text-xs transition-colors focus-visible:border-primary"
                  style={{ width: `${Math.max(3.5, word.word.length * 0.65 + 1.5)}rem` }}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Edit any word — changes appear instantly in the preview.</p>
        </div>
      </CardContent>
    </Card>
  );
}
