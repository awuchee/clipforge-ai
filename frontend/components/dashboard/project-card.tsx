import Link from 'next/link';
import { FileVideo, Scissors, Youtube } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import type { Project } from '@/lib/types';

const SOURCE_ICON = {
  YOUTUBE: Youtube,
  UPLOAD_VIDEO: FileVideo,
  UPLOAD_AUDIO: FileVideo,
} as const;

export function ProjectCard({ project }: { project: Project }) {
  const SourceIcon = SOURCE_ICON[project.sourceType] ?? FileVideo;
  const isProcessing = project.status === 'PROCESSING' || project.status === 'QUEUED' || project.status === 'UPLOADED';

  return (
    <Link href={`/dashboard/projects/${project.id}`} className="group">
      <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
        {/* Preview / thumbnail strip */}
        <div className="relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-secondary to-fuchsia-500/10">
          <SourceIcon className="h-8 w-8 text-primary/70 transition-transform duration-200 group-hover:scale-110" />
          {isProcessing && <div className="absolute inset-0 animate-pulse bg-primary/5" aria-hidden />}
          <div className="absolute right-2 top-2">
            <StatusBadge status={project.status} />
          </div>
        </div>

        <CardHeader className="space-y-0 pb-2">
          <CardTitle className="truncate text-base">{project.title}</CardTitle>
          <p className="text-xs capitalize text-muted-foreground">{project.sourceType.replace('_', ' ').toLowerCase()}</p>
        </CardHeader>

        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">
            {project.durationSec ? `${Math.round(project.durationSec / 60)} min source` : 'Duration pending'}
          </p>
        </CardContent>

        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Scissors className="h-4 w-4" />
            {project.clips.length} clip{project.clips.length === 1 ? '' : 's'}
          </span>
          <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open →
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
