'use client';

import Link from 'next/link';
import { Pencil, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/dashboard/status-badge';
import type { Clip } from '@/lib/types';

export function ClipCard({ clip, projectId, onSelect }: { clip: Clip; projectId: string; onSelect: (clip: Clip) => void }) {
  const isReady = clip.status === 'DONE';

  return (
    <Card
      className={
        isReady
          ? 'group cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
          : 'overflow-hidden'
      }
      onClick={() => isReady && onSelect(clip)}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-t-xl bg-secondary">
        {clip.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnailUrl}
            alt={clip.hookTitles[0] ?? 'Clip thumbnail'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : clip.status === 'PROCESSING' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Rendering...
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {clip.status === 'FAILED' ? 'Failed' : 'Pending'}
          </div>
        )}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity hover:bg-black/30 hover:opacity-100">
            <Play className="h-8 w-8 text-white" />
          </div>
        )}
        {clip.viralScore !== null && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            {clip.viralScore}/100
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
          {Math.round(clip.endSec - clip.startSec)}s
        </div>
      </div>
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{clip.hookTitles[0] ?? `${Math.round(clip.startSec)}s – ${Math.round(clip.endSec)}s`}</p>
          <StatusBadge status={clip.status} />
        </div>
        {clip.errorMessage && clip.status === 'FAILED' && (
          <p className="truncate text-xs text-destructive">{clip.errorMessage}</p>
        )}
        {isReady && (
          <Link href={`/dashboard/projects/${projectId}/clips/${clip.id}`} onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs">
              <Pencil className="h-3 w-3" /> Edit clip
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
