export type AdPlatform = 'TIKTOK' | 'INSTAGRAM_REELS' | 'YOUTUBE_SHORTS';

export interface AdTemplate {
  id: string;
  platform: AdPlatform;
  name: string;
  description: string;
  aspectRatio: '9:16' | '1:1' | '16:9';
  maxDurationSec: number;
  /** Ordered script beats every generated ad script/video for this template follows. */
  structure: Array<'hook' | 'problem' | 'solution' | 'demo' | 'social_proof' | 'cta'>;
}

/**
 * Built-in ad templates for the AI Ad Script Generator and AI Product Ad Video
 * Generator. Each template drives both the script structure (AdScriptsService)
 * and the eventual video render plan (AdVideosService).
 */
export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: 'tiktok-direct-response',
    platform: 'TIKTOK',
    name: 'TikTok Direct Response',
    description: 'Fast hook, relatable problem, product as the fix, urgent CTA.',
    aspectRatio: '9:16',
    maxDurationSec: 30,
    structure: ['hook', 'problem', 'solution', 'cta'],
  },
  {
    id: 'instagram-reels-aspirational',
    platform: 'INSTAGRAM_REELS',
    name: 'Instagram Reels Aspirational',
    description: 'Lifestyle-driven hook, product demo, social proof, soft CTA.',
    aspectRatio: '9:16',
    maxDurationSec: 30,
    structure: ['hook', 'demo', 'social_proof', 'cta'],
  },
  {
    id: 'youtube-shorts-explainer',
    platform: 'YOUTUBE_SHORTS',
    name: 'YouTube Shorts Explainer',
    description: 'Problem-first hook, short explanation of the solution, clear CTA.',
    aspectRatio: '9:16',
    maxDurationSec: 60,
    structure: ['hook', 'problem', 'solution', 'demo', 'cta'],
  },
];

export function getAdTemplate(id: string): AdTemplate | undefined {
  return AD_TEMPLATES.find((t) => t.id === id);
}

export function listAdTemplates(platform?: AdPlatform): AdTemplate[] {
  return platform ? AD_TEMPLATES.filter((t) => t.platform === platform) : AD_TEMPLATES;
}
