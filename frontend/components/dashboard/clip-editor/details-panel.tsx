'use client';

import * as React from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Clip, ClipMetadata } from '@/lib/types';

export function ClipDetailsPanel({ clip, token }: { clip: Clip; token: string | null }) {
  const durationSec = Math.round(clip.endSec - clip.startSec);
  const title = clip.selectedHookTitle ?? clip.hookTitles[0] ?? null;
  const { toast } = useToast();
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const handleDownloadMetadata = async () => {
    if (!token) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const metadata = await apiFetch<ClipMetadata>(`/clips/${clip.id}/metadata`, { token });
      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clip-${clip.id}-metadata.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to download metadata';
      setDownloadError(message);
      toast({ title: 'Download failed', description: message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clip details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {title && <p className="text-sm font-medium">{title}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{durationSec}s</Badge>
          {clip.viralScore !== null && <Badge variant="success">Virality: {clip.viralScore}/100</Badge>}
          {clip.captionTheme && <Badge variant="secondary">{clip.captionTheme} captions</Badge>}
          {clip.platform && <Badge variant="secondary">{clip.platform.replace('_', ' ')}</Badge>}
        </div>

        {clip.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {clip.hashtags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {clip.selectionReason && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Why this clip: </span>
            {clip.selectionReason}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {clip.videoUrl && (
            <a href={clip.videoUrl} download className="inline-flex">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Download className="h-3 w-3" /> MP4
              </Button>
            </a>
          )}
          {clip.srtUrl && (
            <a href={clip.srtUrl} download className="inline-flex">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Download className="h-3 w-3" /> Captions (.srt)
              </Button>
            </a>
          )}
          {clip.thumbnailUrl && (
            <a href={clip.thumbnailUrl} download className="inline-flex">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Download className="h-3 w-3" /> Thumbnail
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleDownloadMetadata}
            disabled={downloading}
          >
            <Download className="h-3 w-3" /> {downloading ? 'Preparing...' : 'Metadata (.json)'}
          </Button>
        </div>
        {downloadError && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {downloadError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
