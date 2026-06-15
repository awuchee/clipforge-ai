'use client';

import * as React from 'react';
import { Scissors } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MIN_CLIP_DURATION_SEC = 3;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * Trim editor operating in the rendered clip's own timeline (0..durationSec).
 * `localStart`/`localEnd` are seconds into the currently rendered video.
 * Renders a single track with two draggable handles and a highlighted selection.
 */
export function TrimEditor({
  durationSec,
  localStart,
  localEnd,
  onChange,
  onScrub,
}: {
  durationSec: number;
  localStart: number;
  localEnd: number;
  onChange: (localStart: number, localEnd: number) => void;
  onScrub: (timeSec: number) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<'start' | 'end' | null>(null);

  const valueFromEvent = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || durationSec <= 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * durationSec;
  };

  const handleStartChange = (value: number) => {
    const next = Math.min(value, localEnd - MIN_CLIP_DURATION_SEC);
    const clamped = Math.max(0, next);
    onChange(clamped, localEnd);
    onScrub(clamped);
  };

  const handleEndChange = (value: number) => {
    const next = Math.max(value, localStart + MIN_CLIP_DURATION_SEC);
    const clamped = Math.min(durationSec, next);
    onChange(localStart, clamped);
    onScrub(clamped);
  };

  React.useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const value = valueFromEvent(e.clientX);
      if (dragging === 'start') handleStartChange(value);
      else handleEndChange(value);
    };
    const handleUp = () => setDragging(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, localStart, localEnd, durationSec]);

  const startPct = durationSec > 0 ? (localStart / durationSec) * 100 : 0;
  const endPct = durationSec > 0 ? (localEnd / durationSec) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scissors className="h-4 w-4" />
          Trim
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
            Start <span className="text-foreground">{formatTime(localStart)}</span>
          </span>
          <span className="text-xs font-medium text-primary">{formatTime(localEnd - localStart)}</span>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
            End <span className="text-foreground">{formatTime(localEnd)}</span>
          </span>
        </div>

        <div
          ref={trackRef}
          className="relative my-6 h-2 select-none rounded-full bg-secondary"
        >
          {/* dimmed regions outside selection */}
          <div className="absolute inset-y-0 left-0 rounded-l-full bg-secondary" style={{ width: `${startPct}%` }} />
          <div className="absolute inset-y-0 right-0 rounded-r-full bg-secondary" style={{ width: `${100 - endPct}%` }} />

          {/* selected range */}
          <div
            className="absolute inset-y-0 rounded-full bg-primary"
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
          />

          {/* start handle */}
          <div
            role="slider"
            aria-label="Start handle"
            aria-valuenow={localStart}
            tabIndex={0}
            onPointerDown={() => setDragging('start')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') handleStartChange(localStart - 0.5);
              if (e.key === 'ArrowRight') handleStartChange(localStart + 0.5);
            }}
            className={cn(
              'absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-primary bg-background shadow-md transition-transform hover:scale-110 active:cursor-grabbing',
              dragging === 'start' && 'scale-110 ring-2 ring-primary/40',
            )}
            style={{ left: `${startPct}%` }}
          />

          {/* end handle */}
          <div
            role="slider"
            aria-label="End handle"
            aria-valuenow={localEnd}
            tabIndex={0}
            onPointerDown={() => setDragging('end')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') handleEndChange(localEnd - 0.5);
              if (e.key === 'ArrowRight') handleEndChange(localEnd + 0.5);
            }}
            className={cn(
              'absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-primary bg-background shadow-md transition-transform hover:scale-110 active:cursor-grabbing',
              dragging === 'end' && 'scale-110 ring-2 ring-primary/40',
            )}
            style={{ left: `${endPct}%` }}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Drag the handles to trim the clip, or use arrow keys for fine adjustments.
        </p>
      </CardContent>
    </Card>
  );
}
