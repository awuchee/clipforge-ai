export const VIDEO_PROCESSING_QUEUE = 'video-processing-queue';

export interface VideoProcessingJobData {
  projectId: string;
  userId: string;
  videoUrl: string | null;
  storageKey: string | null;
}

export const CLIP_RENDER_QUEUE = 'clip-render-queue';

export interface ClipRenderJobData {
  clipId: string;
}

export const AD_VIDEO_RENDER_QUEUE = 'ad-video-render-queue';

export interface AdVideoRenderJobData {
  adProjectId: string;
}
