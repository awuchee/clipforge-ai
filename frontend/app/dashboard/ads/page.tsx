'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Megaphone } from 'lucide-react';
import { AdProjectCard } from '@/components/dashboard/ad-project-card';
import { NewAdProjectForm } from '@/components/dashboard/new-ad-project-form';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { AdProject } from '@/lib/types';

function AdProjectCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <Skeleton className="h-24 w-full rounded-none" />
      <CardHeader className="space-y-2 pb-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </CardHeader>
      <CardContent className="pb-2">
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-3 w-1/4" />
      </CardFooter>
    </Card>
  );
}

export default function AdsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = React.useState<AdProject[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!token) return;
    setError(null);
    apiFetch<AdProject[]>('/ads/projects', { token })
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load ad projects'));
  }, [token, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ad Studio</h1>
          <p className="text-sm text-muted-foreground">
            Describe your product and VixClip AI will generate a full ad video — strategy, script, voiceover,
            captions, and a ready-to-post render.
          </p>
        </div>
        <NewAdProjectForm onCreated={(p) => setProjects((prev) => [p, ...(prev ?? [])])} />
      </div>

      {error && <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!projects && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AdProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-medium">No ad projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first ad project — describe your product, generate a plan, and render a short
            ready-to-post ad video.
          </p>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.05 }}
            >
              <AdProjectCard project={project} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
