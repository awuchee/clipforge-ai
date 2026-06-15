'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { FolderPlus } from 'lucide-react';
import { ProjectCard } from '@/components/dashboard/project-card';
import { NewProjectForm } from '@/components/dashboard/new-project-form';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Project } from '@/lib/types';

function ProjectCardSkeleton() {
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

export default function DashboardPage() {
  const { token } = useAuth();
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!token) return;
    setError(null);
    apiFetch<Project[]>('/projects', { token })
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load projects'));
  }, [token, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Import a video and ClipForge AI will generate clips automatically.
          </p>
        </div>
        <NewProjectForm onCreated={(p) => setProjects((prev) => [p, ...(prev ?? [])])} />
      </div>

      {error && <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!projects && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FolderPlus className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-medium">No projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first project — drop in a YouTube link or upload a video, and ClipForge AI
            will turn it into ready-to-post short clips.
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
              <ProjectCard project={project} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
