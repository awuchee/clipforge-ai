import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AdStatusBadge } from './ad-status-badge';
import type { AdProject } from '@/lib/types';

export function AdProjectCard({ project }: { project: AdProject }) {
  return (
    <Link href={`/dashboard/ads/${project.id}`} className="group">
      <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
        <div className="relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-secondary to-fuchsia-500/10">
          {project.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.thumbnailUrl} alt={project.productName} className="h-full w-full object-cover" />
          ) : (
            <Megaphone className="h-8 w-8 text-primary/70 transition-transform duration-200 group-hover:scale-110" />
          )}
          <div className="absolute right-2 top-2">
            <AdStatusBadge status={project.status} />
          </div>
        </div>

        <CardHeader className="space-y-0 pb-2">
          <CardTitle className="truncate text-base">{project.productName}</CardTitle>
          <p className="line-clamp-2 text-xs text-muted-foreground">{project.productDescription}</p>
        </CardHeader>

        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">
            {project.durationSec ? `${project.durationSec}s ad` : 'Not rendered yet'}
          </p>
        </CardContent>

        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{project.templateId.replace(/-/g, ' ')}</span>
          <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open →
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
