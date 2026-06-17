'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { AdProject, AdTemplate } from '@/lib/types';

export function NewAdProjectForm({ onCreated }: { onCreated: (project: AdProject) => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<AdTemplate[] | null>(null);
  const [productName, setProductName] = React.useState('');
  const [productDescription, setProductDescription] = React.useState('');
  const [templateId, setTemplateId] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [tone, setTone] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !token || templates) return;
    apiFetch<AdTemplate[]>('/ads/templates', { token })
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) setTemplateId(data[0].id);
      })
      .catch(() => setTemplates([]));
  }, [open, token, templates]);

  const reset = () => {
    setOpen(false);
    setProductName('');
    setProductDescription('');
    setTargetAudience('');
    setTone('');
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const project = await apiFetch<AdProject>('/ads/projects', {
        method: 'POST',
        token,
        body: {
          productName,
          productDescription,
          templateId,
          ...(targetAudience ? { targetAudience } : {}),
          ...(tone ? { tone } : {}),
        },
      });
      onCreated(project);
      toast({ title: 'Ad project created', description: 'Now generate a plan to get started.', variant: 'success' });
      reset();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not create ad project';
      setError(message);
      toast({ title: 'Could not create ad project', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : reset())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New ad project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New ad project</DialogTitle>
          <DialogDescription>
            Describe your product and VixClip AI will generate a full ad strategy, script, and scene-by-scene
            video plan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Product name</Label>
            <Input
              id="productName"
              required
              minLength={2}
              maxLength={120}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="GlowBottle"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription">Product description</Label>
            <textarea
              id="productDescription"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="A smart water bottle that tracks your hydration and glows to remind you to drink water throughout the day."
              className="flex w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateId">Ad template</Label>
            <select
              id="templateId"
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {!templates && <option value="">Loading templates...</option>}
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.aspectRatio}, up to {t.maxDurationSec}s)
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target audience (optional)</Label>
              <Input
                id="targetAudience"
                maxLength={200}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Busy young professionals"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone (optional)</Label>
              <Input
                id="tone"
                maxLength={50}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Energetic and fun"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting || !templateId}>
            {isSubmitting ? 'Creating...' : 'Create ad project'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
