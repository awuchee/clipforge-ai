'use client';

import * as React from 'react';
import { FileVideo, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadFile, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import type { Project, SourceType } from '@/lib/types';

const acceptByType: Record<'UPLOAD_VIDEO' | 'UPLOAD_AUDIO', string> = {
  UPLOAD_VIDEO: 'video/*',
  UPLOAD_AUDIO: 'audio/*',
};

export function UploadDropzone({
  projectId,
  sourceType,
  onUploaded,
  onLimitReached,
}: {
  projectId: string;
  sourceType: SourceType;
  onUploaded: (project: Project) => void;
  onLimitReached?: () => void;
}) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const accept = sourceType === 'UPLOAD_AUDIO' ? acceptByType.UPLOAD_AUDIO : acceptByType.UPLOAD_VIDEO;

  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const startUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const updated = await uploadFile<Project>(`/projects/${projectId}/upload`, file, token, setProgress);
      onUploaded(updated);
      toast({ title: 'Upload complete', description: 'VixClip AI is starting to process your video.', variant: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') {
        onLimitReached?.();
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Upload failed';
      setError(message);
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-all duration-150',
          isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/40 hover:bg-secondary/30',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {file ? (
          <>
            <FileVideo className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drag & drop your file here, or click to browse</p>
            <p className="text-xs text-muted-foreground">
              {sourceType === 'UPLOAD_AUDIO' ? 'MP3 or WAV' : 'MP4'}
            </p>
          </>
        )}
      </div>

      {isUploading && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" className="w-full" disabled={!file || isUploading} onClick={startUpload}>
        {isUploading ? `Uploading... ${progress}%` : 'Upload'}
      </Button>
    </div>
  );
}
