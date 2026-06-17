'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { FileVideo, Film, Scissors } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { ClipCard } from '@/components/dashboard/clip-card';
import { ClipPreviewModal } from '@/components/dashboard/clip-preview-modal';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { Clip, Project, ProjectStatus } from '@/lib/types';

const ACTIVE_STATUSES: ProjectStatus['status'][] = ['UPLOADED', 'QUEUED', 'PROCESSING'];
const POLL_INTERVAL_MS = 4000;

const PROCESSING_LABEL: Record<ProjectStatus['status'], string> = {
  PENDING: 'Waiting for upload...',
  UPLOADED: 'Queued for processing...',
  QUEUED: 'Queued for processing...',
  PROCESSING: 'AI is analyzing your video and generating clips...',
  DONE: 'Processing complete.',
  FAILED: 'Processing failed.',
  REJECTED: 'Processing complete.',
};

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = React.useState<Project | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedClip, setSelectedClip] = React.useState<Clip | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!token) return;
    setError(null);
    apiFetch<Project>(`/projects/${id}`, { token })
      .then(setProject)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load project'));
  }, [token, id, reloadKey]);

  // Poll status while the project is still being processed, then refetch the
  // full project (with clips) once it reaches a terminal state.
  React.useEffect(() => {
    if (!token || !project) return;
    if (!ACTIVE_STATUSES.includes(project.status)) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiFetch<ProjectStatus>(`/projects/${id}/status`, { token });
        if (status.status !== project.status || !ACTIVE_STATUSES.includes(status.status)) {
          const updated = await apiFetch<Project>(`/projects/${id}`, { token });
          setProject(updated);
          if (status.status === 'DONE') {
            toast({
              title: 'Clips are ready',
              description: `${status.clipCount} clip${status.clipCount === 1 ? '' : 's'} generated for "${updated.title}".`,
              variant: 'success',
            });
          } else if (status.status === 'FAILED') {
            toast({
              title: 'Processing failed',
              description: status.errorMessage ?? 'Something went wrong while processing this video.',
              variant: 'destructive',
            });
          }
        }
      } catch {
        // ignore transient polling errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token, id, project]);

  if (error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="aspect-video w-full lg:col-span-2" />
          <Skeleton className="aspect-video w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="text-sm capitalize text-muted-foreground">{project.sourceType.replace('_', ' ').toLowerCase()}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {ACTIVE_STATUSES.includes(project.status) && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <p className="text-sm text-muted-foreground">{PROCESSING_LABEL[project.status]}</p>
          </CardContent>
        </Card>
      )}

      {project.status === 'FAILED' && project.errorMessage && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{project.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileVideo className="h-4 w-4" />
              Video player
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.videoUrl ? (
              <video
                src={project.videoUrl}
                controls
                className="aspect-video w-full rounded-lg border border-border bg-black"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {project.sourceType === 'YOUTUBE'
                  ? 'Video will appear here once the source is processed.'
                  : 'Upload a source file to preview it here.'}
              </div>
            )}
            {project.originalFilename && (
              <p className="mt-2 text-xs text-muted-foreground">Source: {project.originalFilename}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {project.status === 'DONE' || project.status === 'PROCESSING'
                ? 'Transcript is generated during processing and used to find highlight moments.'
                : 'Transcript will appear here once transcription is complete.'}
            </p>
            {project.durationSec !== null && (
              <p className="mt-2 text-xs text-muted-foreground">Duration: {Math.round(project.durationSec)}s</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-4 w-4" />
            Clips ({project.clips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {project.clips.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Film className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-medium">No clips yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {ACTIVE_STATUSES.includes(project.status)
                  ? 'VixClip AI is analyzing your video — clips will appear here as soon as they’re ready.'
                  : 'Clips will appear here once processing finishes.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {project.clips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} projectId={project.id} onSelect={setSelectedClip} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ClipPreviewModal clip={selectedClip} onClose={() => setSelectedClip(null)} />
    </div>
  );
}
