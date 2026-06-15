'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadDropzone } from './upload-dropzone';
import { UpgradeModal } from './upgrade-modal';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { Project, SourceType } from '@/lib/types';

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: 'YOUTUBE', label: 'YouTube URL' },
  { value: 'UPLOAD_VIDEO', label: 'Video file (MP4)' },
  { value: 'UPLOAD_AUDIO', label: 'Audio file (MP3/WAV)' },
];

export function NewProjectForm({ onCreated }: { onCreated: (project: Project) => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [sourceType, setSourceType] = React.useState<SourceType>('YOUTUBE');
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [pendingProject, setPendingProject] = React.useState<Project | null>(null);
  const [showUpgrade, setShowUpgrade] = React.useState(false);

  const reset = () => {
    setOpen(false);
    setTitle('');
    setSourceUrl('');
    setSourceType('YOUTUBE');
    setPendingProject(null);
    setError(null);
  };

  if (!open) {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New project
        </Button>
        <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  // Step 2: project record exists, now upload the source file.
  if (pendingProject) {
    return (
      <>
        <Card className="w-full max-w-md">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upload source file</CardTitle>
            <Button variant="ghost" size="icon" onClick={reset}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <UploadDropzone
              projectId={pendingProject.id}
              sourceType={pendingProject.sourceType}
              onUploaded={(updated) => {
                onCreated(updated);
                reset();
              }}
              onLimitReached={() => {
                reset();
                setShowUpgrade(true);
              }}
            />
          </CardContent>
        </Card>
        <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const project = await apiFetch<Project>('/projects', {
        method: 'POST',
        token,
        body: {
          title,
          sourceType,
          ...(sourceType === 'YOUTUBE' ? { sourceUrl } : {}),
        },
      });

      if (sourceType === 'YOUTUBE') {
        onCreated(project);
        toast({ title: 'Project created', description: 'ClipForge AI is starting to process your video.', variant: 'success' });
        reset();
      } else {
        // Move to step 2: upload the file for this project.
        setPendingProject(project);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') {
        reset();
        setShowUpgrade(true);
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Could not create project';
      setError(message);
      toast({ title: 'Could not create project', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Card className="w-full max-w-md">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">New project</CardTitle>
        <Button variant="ghost" size="icon" onClick={reset}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My podcast episode #42"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceType">Source</Label>
            <select
              id="sourceType"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {sourceType === 'YOUTUBE' && (
            <div className="space-y-2">
              <Label htmlFor="sourceUrl">YouTube URL</Label>
              <Input
                id="sourceUrl"
                required
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          )}

          {sourceType !== 'YOUTUBE' && (
            <p className="text-sm text-muted-foreground">
              You&apos;ll upload your {sourceType === 'UPLOAD_AUDIO' ? 'audio' : 'video'} file in the next step.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : sourceType === 'YOUTUBE' ? 'Create project' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
    <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  );
}
