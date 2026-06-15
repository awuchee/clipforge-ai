export type ProcessingStatus = 'PENDING' | 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED' | 'REJECTED';
export type SourceType = 'YOUTUBE' | 'UPLOAD_VIDEO' | 'UPLOAD_AUDIO';

export type HookCategory = 'curiosity' | 'authority' | 'shock' | 'storytelling';
export type HookVariations = Record<HookCategory, string[]>;
export type CaptionTheme = 'bold' | 'minimal' | 'neon' | 'classic';
export type CaptionPosition = 'top' | 'middle' | 'bottom';

export type CaptionWord = {
  word: string;
  start: number;
  end: number;
};

export type Clip = {
  id: string;
  startSec: number;
  endSec: number;
  storageKey: string | null;
  thumbnailKey: string | null;
  srtKey: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  srtUrl: string | null;
  hookTitles: string[];
  hookVariations: HookVariations | null;
  selectedHookTitle: string | null;
  description: string | null;
  hashtags: string[];
  viralScore: number | null;
  qualityScore: number | null;
  selectionReason: string | null;
  platform: string | null;
  captionTheme: CaptionTheme | null;
  captionWords: CaptionWord[] | null;
  fontSize: number | null;
  captionPosition: CaptionPosition | null;
  emojiEnabled: boolean;
  status: ProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type ClipMetadata = {
  id: string;
  title: string | null;
  hookTitles: string[];
  hookVariations: HookVariations | null;
  selectedHookTitle: string | null;
  description: string | null;
  hashtags: string[];
  viralScore: number | null;
  qualityScore: number | null;
  selectionReason: string | null;
  platform: string | null;
  captionTheme: string | null;
  startSec: number;
  endSec: number;
  durationSec: number;
};

export type UpdateClipPayload = {
  startSec?: number;
  endSec?: number;
  captionTheme?: CaptionTheme;
  fontSize?: number;
  captionPosition?: CaptionPosition;
  emojiEnabled?: boolean;
  captionWords?: CaptionWord[];
  hookTitles?: string[];
  selectedHookTitle?: string;
};

export type Project = {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  storageKey: string | null;
  videoUrl: string | null;
  originalFilename: string | null;
  status: ProcessingStatus;
  durationSec: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  clips: Clip[];
};

export type ProjectStatus = {
  id: string;
  status: ProcessingStatus;
  durationSec: number | null;
  errorMessage: string | null;
  clipCount: number;
  updatedAt: string;
};
