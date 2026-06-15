import * as React from 'react';
import { CheckCircle2, Clock, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProcessingStatus } from '@/lib/types';

const variantByStatus: Record<ProcessingStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  UPLOADED: 'secondary',
  QUEUED: 'secondary',
  PROCESSING: 'warning',
  DONE: 'success',
  FAILED: 'destructive',
  REJECTED: 'destructive',
};

const labelByStatus: Record<ProcessingStatus, string> = {
  PENDING: 'Pending upload',
  UPLOADED: 'Uploaded',
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  DONE: 'Done',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
};

const iconByStatus: Record<ProcessingStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Clock,
  UPLOADED: UploadCloud,
  QUEUED: Clock,
  PROCESSING: Loader2,
  DONE: CheckCircle2,
  FAILED: XCircle,
  REJECTED: XCircle,
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  const Icon = iconByStatus[status];
  return (
    <Badge variant={variantByStatus[status]} className="gap-1.5">
      <Icon className={cn('h-3 w-3', status === 'PROCESSING' && 'animate-spin')} />
      {labelByStatus[status]}
      {status === 'PROCESSING' && (
        <span className="relative ml-0.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
        </span>
      )}
    </Badge>
  );
}
