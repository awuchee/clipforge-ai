'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Download, FileVideo, Megaphone, Sparkles, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdStatusBadge } from '@/components/dashboard/ad-status-badge';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { AdProject, AdProjectStatusResponse } from '@/lib/types';

const ACTIVE_STATUSES: AdProject['status'][] = ['QUEUED', 'PROCESSING'];
const POLL_INTERVAL_MS = 4000;

const PROCESSING_LABEL: Record<AdProject['status'], string> = {
  DRAFT: 'Generate a plan to get started.',
  PLAN_READY: 'Plan is ready. Render the video when you are ready.',
  QUEUED: 'Queued for rendering...',
  PROCESSING: 'AI is generating voiceover, rendering scenes, and assembling your ad...',
  DONE: 'Your ad video is ready.',
  FAILED: 'Rendering failed.',
};

export default function AdProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = React.useState<AdProject | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [isGeneratingPlan, setIsGeneratingPlan] = React.useState(false);
  const [isRendering, setIsRendering] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    setError(null);
    apiFetch<AdProject>(`/ads/projects/${id}`, { token })
      .then(setProject)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load ad project'));
  }, [token, id, reloadKey]);

  React.useEffect(() => {
    if (!token || !project) return;
    if (!ACTIVE_STATUSES.includes(project.status)) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiFetch<AdProjectStatusResponse>(`/ads/projects/${id}/status`, { token });
        if (status.status !== project.status || !ACTIVE_STATUSES.includes(status.status)) {
          const updated = await apiFetch<AdProject>(`/ads/projects/${id}`, { token });
          setProject(updated);
          if (status.status === 'DONE') {
            toast({
              title: 'Ad video is ready',
              description: `"${updated.productName}" has finished rendering.`,
              variant: 'success',
            });
          } else if (status.status === 'FAILED') {
            toast({
              title: 'Rendering failed',
              description: status.errorMessage ?? 'Something went wrong while rendering this ad.',
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

  const onGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const updated = await apiFetch<AdProject>(`/ads/projects/${id}/plan`, { method: 'POST', token });
      setProject(updated);
      toast({ title: 'Plan generated', description: 'Review the script and scenes, then render your ad.', variant: 'success' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not generate plan';
      toast({ title: 'Could not generate plan', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const onRender = async () => {
    setIsRendering(true);
    try {
      const updated = await apiFetch<AdProject>(`/ads/projects/${id}/render`, { method: 'POST', token });
      setProject(updated);
      toast({ title: 'Render started', description: 'Your ad video is being generated. This may take a few minutes.', variant: 'success' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not start render';
      toast({ title: 'Could not start render', description: message, variant: 'destructive' });
    } finally {
      setIsRendering(false);
    }
  };

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
          <Skeleton className="aspect-[9/16] w-full max-w-xs lg:col-span-1" />
          <Skeleton className="h-64 w-full lg:col-span-2" />
        </div>
      </div>
    );
  }

  const canGeneratePlan = project.status === 'DRAFT' || project.status === 'FAILED';
  const canRender =
    project.plan !== null &&
    (project.status === 'PLAN_READY' || project.status === 'DONE' || project.status === 'FAILED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.productName}</h1>
          <p className="text-sm text-muted-foreground">{project.productDescription}</p>
        </div>
        <AdStatusBadge status={project.status} />
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
            <p className="text-sm font-medium text-destructive">Rendering failed</p>
            <p className="mt-1 text-sm text-destructive/80">{project.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onGeneratePlan} disabled={!canGeneratePlan || isGeneratingPlan} variant="secondary">
          <Sparkles className="h-4 w-4" />
          {isGeneratingPlan ? 'Generating plan...' : project.plan ? 'Regenerate plan' : 'Generate plan'}
        </Button>
        <Button onClick={onRender} disabled={!canRender || isRendering}>
          <Wand2 className="h-4 w-4" />
          {isRendering ? 'Starting render...' : 'Render video'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileVideo className="h-4 w-4" />
              Video preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.videoUrl ? (
              <video
                src={project.videoUrl}
                poster={project.thumbnailUrl ?? undefined}
                controls
                className="aspect-[9/16] w-full rounded-lg border border-border bg-black"
              />
            ) : project.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.thumbnailUrl}
                alt={project.productName}
                className="aspect-[9/16] w-full rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2 p-4">
                  <Megaphone className="h-6 w-6 text-muted-foreground/60" />
                  Your rendered ad will appear here.
                </div>
              </div>
            )}

            {project.videoUrl && (
              <Button asChild variant="outline" className="mt-3 w-full">
                <a href={project.videoUrl} download>
                  <Download className="h-4 w-4" />
                  Download video
                </a>
              </Button>
            )}

            {project.durationSec !== null && (
              <p className="mt-2 text-xs text-muted-foreground">Duration: {Math.round(project.durationSec)}s</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!project.plan ? (
              <p className="text-sm text-muted-foreground">
                No plan generated yet. Click "Generate plan" to create a strategy, script, and scene breakdown for
                this ad.
              </p>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-medium">Strategy</h3>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Target audience</dt>
                      <dd>{project.plan.adStrategy.targetAudience}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Core message</dt>
                      <dd>{project.plan.adStrategy.coreMessage}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Emotional angle</dt>
                      <dd>{project.plan.adStrategy.emotionalAngle}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Conversion goal</dt>
                      <dd>{project.plan.adStrategy.conversionGoal}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Script</h3>
                  <dl className="mt-2 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Hook</dt>
                      <dd>{project.plan.script.hook}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Problem</dt>
                      <dd>{project.plan.script.problem}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Solution</dt>
                      <dd>{project.plan.script.solution}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Benefits</dt>
                      <dd>{project.plan.script.benefits}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Call to action</dt>
                      <dd>{project.plan.script.callToAction}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Scenes ({project.plan.scenes.length})</h3>
                  <div className="mt-2 space-y-2">
                    {project.plan.scenes.map((scene) => (
                      <div key={scene.sceneNumber} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Scene {scene.sceneNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {scene.durationSeconds}s &middot; {scene.transitionType}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{scene.visualDescription}</p>
                        <p className="mt-1 italic">"{scene.voiceover}"</p>
                        <p className="mt-1 text-xs text-muted-foreground">On-screen: {scene.onScreenText}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Hashtags</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.plan.socialOutput.hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
