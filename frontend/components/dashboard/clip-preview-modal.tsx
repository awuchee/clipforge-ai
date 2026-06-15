'use client';

import * as React from 'react';
import { AlertCircle, Check, Copy, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { Clip, ClipMetadata, HookCategory } from '@/lib/types';

const HOOK_CATEGORY_LABELS: Record<HookCategory, string> = {
  curiosity: 'Curiosity',
  authority: 'Authority',
  shock: 'Shock',
  storytelling: 'Storytelling',
};

function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  // Fallback for non-secure contexts / older browsers.
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await copyToClipboard(value);
      setCopied(true);
      toast({ title: 'Copied to clipboard', variant: 'success' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access is unavailable.', variant: 'destructive' });
    }
  };

  return (
    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function ClipPreviewModal({ clip, onClose }: { clip: Clip | null; onClose: () => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const handleDownloadMetadata = async () => {
    if (!clip || !token) return;
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
    <Dialog open={!!clip} onOpenChange={(open) => !open && onClose()}>
      {clip && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{clip.hookTitles[0] ?? `Clip ${Math.round(clip.startSec)}s - ${Math.round(clip.endSec)}s`}</DialogTitle>
            {clip.description && <DialogDescription>{clip.description}</DialogDescription>}
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
            <div className="overflow-hidden rounded-lg border border-border bg-black">
              {clip.videoUrl ? (
                <video src={clip.videoUrl} controls className="aspect-[9/16] w-full" />
              ) : (
                <div className="flex aspect-[9/16] items-center justify-center text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {clip.viralScore !== null && (
                  <Badge variant="success">Virality score: {clip.viralScore}/100</Badge>
                )}
                {clip.platform && <Badge variant="secondary">{clip.platform.replace('_', ' ')}</Badge>}
                <Badge variant="secondary">{Math.round(clip.endSec - clip.startSec)}s</Badge>
                {clip.captionTheme && <Badge variant="secondary">{clip.captionTheme} captions</Badge>}
              </div>

              {clip.hookTitles[0] && (
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton value={clip.hookTitles[0]} label="Copy title" />
                  {clip.description && <CopyButton value={clip.description} label="Copy description" />}
                  {clip.hashtags.length > 0 && (
                    <CopyButton value={clip.hashtags.map((tag) => `#${tag}`).join(' ')} label="Copy hashtags" />
                  )}
                </div>
              )}

              {clip.hookVariations && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">More hook ideas</p>
                  <div className="mt-1 space-y-2">
                    {(Object.keys(HOOK_CATEGORY_LABELS) as HookCategory[]).map((category) => {
                      const titles = clip.hookVariations?.[category];
                      if (!titles || titles.length === 0) return null;
                      return (
                        <div key={category}>
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                            {HOOK_CATEGORY_LABELS[category]}
                          </p>
                          <ul className="mt-0.5 space-y-1">
                            {titles.map((title) => (
                              <li key={title} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">{title}</span>
                                <CopyButton value={title} label="" />
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
