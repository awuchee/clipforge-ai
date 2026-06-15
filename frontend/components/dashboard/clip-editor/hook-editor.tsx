'use client';

import { Check, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { HookCategory, HookVariations } from '@/lib/types';

const HOOK_CATEGORY_LABELS: Record<HookCategory, string> = {
  curiosity: 'Curiosity',
  authority: 'Authority',
  shock: 'Shock',
  storytelling: 'Storytelling',
};

export function HookEditor({
  hookTitles,
  hookVariations,
  selectedHookTitle,
  regenerating,
  onHookTitlesChange,
  onSelectedChange,
  onRegenerate,
}: {
  hookTitles: string[];
  hookVariations: HookVariations | null;
  selectedHookTitle: string;
  regenerating: boolean;
  onHookTitlesChange: (titles: string[]) => void;
  onSelectedChange: (title: string) => void;
  onRegenerate: () => void;
}) {
  const handleTitleChange = (index: number, value: string) => {
    const next = hookTitles.slice();
    const previous = next[index];
    next[index] = value;
    onHookTitlesChange(next);
    if (selectedHookTitle === previous) {
      onSelectedChange(value);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Hook title</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          <RefreshCw className={cn('h-3 w-3', regenerating && 'animate-spin')} />
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your titles — pick one and edit freely</p>
          {hookTitles.map((title, i) => {
            const active = selectedHookTitle === title;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2 transition-colors',
                  active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectedChange(title)}
                  aria-label="Select hook title"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                </button>
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(i, e.target.value)}
                  className="h-8 border-none bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            );
          })}
        </div>

        {hookVariations && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              More AI ideas — click to use
            </p>
            {(Object.keys(HOOK_CATEGORY_LABELS) as HookCategory[]).map((category) => {
              const titles = (hookVariations[category] ?? []).filter((t) => !hookTitles.includes(t));
              if (titles.length === 0) return null;
              return (
                <div key={category} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {HOOK_CATEGORY_LABELS[category]}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {titles.map((title) => {
                      const active = selectedHookTitle === title;
                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() => onSelectedChange(title)}
                          className={cn(
                            'max-w-full truncate rounded-full border px-3 py-1.5 text-left text-xs transition-colors',
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                          )}
                          title={title}
                        >
                          {title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
