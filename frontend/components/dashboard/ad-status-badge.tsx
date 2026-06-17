import * as React from 'react';
import { CheckCircle2, Clock, FileEdit, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AdProjectStatus } from '@/lib/types';

const variantByStatus: Record<AdProjectStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  PLAN_READY: 'secondary',
  QUEUED: 'warning',
  PROCESSING: 'warning',
  DONE: 'success',
  FAILED: 'destructive',
};

const labelByStatus: Record<AdProjectStatus, string> = {
  DRAFT: 'Draft',
  PLAN_READY: 'Plan ready',
  QUEUED: 'Queued',
  PROCESSING: 'Rendering',
  DONE: 'Done',
  FAILED: 'Failed',
};

const iconByStatus: Record<AdProjectStatus, React.ComponentType<{ className?: string }>> = {
  DRAFT: FileEdit,
  PLAN_READY: FileEdit,
  QUEUED: Clock,
  PROCESSING: Loader2,
  DONE: CheckCircle2,
  FAILED: XCircle,
};

export function AdStatusBadge({ status }: { status: AdProjectStatus }) {
  const Icon = iconByStatus[status];
  return (
    <Badge variant={variantByStatus[status]} className="gap-1.5">
      <Icon className={cn('h-3 w-3', status === 'PROCESSING' && 'animate-spin')} />
      {labelByStatus[status]}
      {(status === 'PROCESSING' || status === 'QUEUED') && (
        <span className="relative ml-0.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
        </span>
      )}
    </Badge>
  );
}
