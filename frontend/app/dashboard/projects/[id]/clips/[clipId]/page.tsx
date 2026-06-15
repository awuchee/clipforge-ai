'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { CaptionEditor } from '@/components/dashboard/clip-editor/caption-editor';
import { CaptionPreviewOverlay } from '@/components/dashboard/clip-editor/caption-preview-overlay';
import { TrimEditor } from '@/components/dashboard/clip-editor/trim-editor';
import { HookEditor } from '@/components/dashboard/clip-editor/hook-editor';
import { ClipDetailsPanel } from '@/components/dashboard/clip-editor/details-panel';
import { CAPTION_THEME_PREVIEWS } from '@/lib/caption-themes';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { CaptionPosition, CaptionTheme, CaptionWord, Clip, UpdateClipPayload } from '@/lib/types';

const POLL_INTERVAL_MS = 3000;

type DraftState = {
  startSec: number;
  endSec: number;
  captionTheme: CaptionTheme;
  fontSize: number;
  captionPosition: CaptionPosition;
  emojiEnabled: boolean;
  captionWords: CaptionWord[];
  hookTitles: string[];
  selectedHookTitle: string;
};

function toDraft(clip: Clip): DraftState {
  const theme = clip.captionTheme ?? 'bold';
  return {
    startSec: clip.startSec,
    endSec: clip.endSec,
    captionTheme: theme,
    fontSize: clip.fontSize ?? CAPTION_THEME_PREVIEWS[theme].fontSize,
    captionPosition: clip.captionPosition ?? 'bottom',
    emojiEnabled: clip.emojiEnabled,
    captionWords: clip.captionWords ?? [],
    hookTitles: clip.hookTitles,
    selectedHookTitle: clip.selectedHookTitle ?? clip.hookTitles[0] ?? '',
  };
}

function isDirty(clip: Clip, draft: DraftState): boolean {
  const base = toDraft(clip);
  return (
    base.startSec !== draft.startSec ||
    base.endSec !== draft.endSec ||
    base.captionTheme !== draft.captionTheme ||
    base.fontSize !== draft.fontSize ||
    base.captionPosition !== draft.captionPosition ||
    base.emojiEnabled !== draft.emojiEnabled ||
    base.selectedHookTitle !== draft.selectedHookTitle ||
    JSON.stringify(base.captionWords) !== JSON.stringify(draft.captionWords) ||
    JSON.stringify(base.hookTitles) !== JSON.stringify(draft.hookTitles)
  );
}

export default function ClipEditorPage() {
  const { id: projectId, clipId } = useParams<{ id: string; clipId: string }>();
  const { token } = useAuth();
  const { toast } = useToast();

  const [clip, setClip] = React.useState<Clip | null>(null);
  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  // The window the *currently rendered* video covers (its own 0..duration timeline).
  const [renderedWindow, setRenderedWindow] = React.useState<{ start: number; end: number } | null>(null);

  const loadClip = React.useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const data = await apiFetch<Clip>(`/clips/${clipId}`, { token });
      setClip(data);
      setDraft(toDraft(data));
      setRenderedWindow({ start: data.startSec, end: data.endSec });
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load clip');
    }
  }, [token, clipId]);

  React.useEffect(() => {
    loadClip();
  }, [loadClip]);

  // Poll while the clip is rendering.
  React.useEffect(() => {
    if (!token || !clip) return;
    if (clip.status !== 'PROCESSING') return;

    const interval = setInterval(async () => {
      try {
        const data = await apiFetch<Clip>(`/clips/${clipId}`, { token });
        if (data.status !== 'PROCESSING') {
          setClip(data);
          setDraft(toDraft(data));
          setRenderedWindow({ start: data.startSec, end: data.endSec });
        }
      } catch {
        // ignore transient polling errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token, clip, clipId]);

  if (loadError) {
    return <ErrorState message={loadError} onRetry={loadClip} />;
  }

  if (!clip || !draft || !renderedWindow) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[280px]" />
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const durationSec = renderedWindow.end - renderedWindow.start;
  const localStart = draft.startSec - renderedWindow.start;
  const localEnd = draft.endSec - renderedWindow.start;
  const absoluteTime = renderedWindow.start + currentTime;
  const dirty = isDirty(clip, draft);
  const isProcessing = clip.status === 'PROCESSING';

  const handleScrub = (localSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = localSeconds;
    }
    setCurrentTime(localSeconds);
  };

  const handleSave = async () => {
    if (!token || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateClipPayload = {
        startSec: draft.startSec,
        endSec: draft.endSec,
        captionTheme: draft.captionTheme,
        fontSize: draft.fontSize,
        captionPosition: draft.captionPosition,
        emojiEnabled: draft.emojiEnabled,
        captionWords: draft.captionWords,
        hookTitles: draft.hookTitles,
        selectedHookTitle: draft.selectedHookTitle,
      };
      const updated = await apiFetch<Clip>(`/clips/${clipId}`, { method: 'PATCH', token, body: payload });
      setClip(updated);
      setDraft(toDraft(updated));
      toast({
        title: 'Clip updated',
        description: 'Your changes are being re-rendered.',
        variant: 'success',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save clip';
      setError(message);
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateHooks = async () => {
    if (!token) return;
    setRegenerating(true);
    setError(null);
    try {
      const updated = await apiFetch<Clip>(`/clips/${clipId}/regenerate-hooks`, { method: 'POST', token });
      setClip(updated);
      setDraft((prev) =>
        prev
          ? { ...prev, hookTitles: updated.hookTitles, selectedHookTitle: updated.selectedHookTitle ?? updated.hookTitles[0] ?? '' }
          : toDraft(updated),
      );
      toast({ title: 'New hooks generated', variant: 'success' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to regenerate hooks';
      setError(message);
      toast({ title: 'Regeneration failed', description: message, variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div>
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to project
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Edit clip</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={clip.status} />
          <Button onClick={handleSave} disabled={!dirty || saving || isProcessing} className="min-w-[150px]">
            {saving || isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isProcessing ? 'Rendering...' : saving ? 'Saving...' : dirty ? 'Save & re-render' : 'Saved'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {isProcessing && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">Re-rendering clip with your changes...</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-black shadow-xl shadow-primary/5 ring-1 ring-border/50">
            {clip.videoUrl ? (
              <video
                ref={videoRef}
                src={clip.videoUrl}
                controls
                className="aspect-[9/16] w-full"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
            ) : (
              <div className="flex aspect-[9/16] items-center justify-center text-xs text-muted-foreground">Preview unavailable</div>
            )}
            {clip.videoUrl && (
              <CaptionPreviewOverlay
                words={draft.captionWords}
                currentTimeSec={absoluteTime}
                theme={draft.captionTheme}
                fontSize={draft.fontSize}
                position={draft.captionPosition}
                emojiEnabled={draft.emojiEnabled}
              />
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">Live preview reflects unsaved caption changes.</p>
        </div>

        <div className="space-y-6">
          <ClipDetailsPanel clip={clip} token={token} />

          <TrimEditor
            durationSec={durationSec}
            localStart={localStart}
            localEnd={localEnd}
            onChange={(start, end) =>
              setDraft((prev) =>
                prev ? { ...prev, startSec: renderedWindow.start + start, endSec: renderedWindow.start + end } : prev,
              )
            }
            onScrub={handleScrub}
          />

          <CaptionEditor
            words={draft.captionWords}
            theme={draft.captionTheme}
            fontSize={draft.fontSize}
            position={draft.captionPosition}
            emojiEnabled={draft.emojiEnabled}
            onWordsChange={(words) => setDraft((prev) => (prev ? { ...prev, captionWords: words } : prev))}
            onThemeChange={(theme) =>
              setDraft((prev) => (prev ? { ...prev, captionTheme: theme, fontSize: CAPTION_THEME_PREVIEWS[theme].fontSize } : prev))
            }
            onFontSizeChange={(fontSize) => setDraft((prev) => (prev ? { ...prev, fontSize } : prev))}
            onPositionChange={(position) => setDraft((prev) => (prev ? { ...prev, captionPosition: position } : prev))}
            onEmojiToggle={(enabled) => setDraft((prev) => (prev ? { ...prev, emojiEnabled: enabled } : prev))}
          />

          <HookEditor
            hookTitles={draft.hookTitles}
            hookVariations={clip.hookVariations}
            selectedHookTitle={draft.selectedHookTitle}
            regenerating={regenerating}
            onHookTitlesChange={(titles) => setDraft((prev) => (prev ? { ...prev, hookTitles: titles } : prev))}
            onSelectedChange={(title) => setDraft((prev) => (prev ? { ...prev, selectedHookTitle: title } : prev))}
            onRegenerate={handleRegenerateHooks}
          />
        </div>
      </div>
    </div>
  );
}
