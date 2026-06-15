import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type HookCategory = 'curiosity' | 'authority' | 'shock' | 'storytelling';

export type HookVariations = Record<HookCategory, string[]>;

export interface ViralMetadata {
  /** Top picks shown by default (one per category, best first). */
  hookTitles: string[];
  /** Full set of generated title variations, grouped by hook style. */
  hookVariations: HookVariations;
  description: string;
  hashtags: string[];
  viralScore: number;
  platform: string;
  selectionReason: string;
}

const HOOK_CATEGORIES: HookCategory[] = ['curiosity', 'authority', 'shock', 'storytelling'];

@Injectable()
export class ViralMetadataService {
  private readonly logger = new Logger(ViralMetadataService.name);
  private readonly client?: OpenAI;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  /**
   * Generates 10 hook title variations across 4 proven short-form styles
   * (curiosity, authority, shock, storytelling), a description, hashtags, a
   * 0-100 virality score, a suggested platform, and a selection reason.
   * Falls back to a deterministic heuristic if no OpenAI key is configured
   * or the API call fails.
   */
  async generate(clipText: string, heuristicScore: number, heuristicReason: string): Promise<ViralMetadata> {
    const fallback = this.fallback(clipText, heuristicScore, heuristicReason);
    if (!this.client) return fallback;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.85,
        messages: [
          {
            role: 'system',
            content:
              'You are a viral short-form video strategist. Given a transcript excerpt from a longer ' +
              'video/podcast, return a JSON object with: ' +
              'hookVariations (object with 4 keys - "curiosity", "authority", "shock", "storytelling" - ' +
              'each an array of EXACTLY 2-3 short, punchy title options under 80 characters in that style; ' +
              'curiosity = creates an information gap ("Why nobody talks about..."), authority = positions ' +
              'the speaker as an expert ("The #1 mistake experts make..."), shock = surprising/contrarian ' +
              'claim ("This will ruin your morning routine"), storytelling = frames it as a narrative moment ' +
              '("The moment everything changed...")), ' +
              'description (1-2 sentence caption with a call to action), ' +
              'hashtags (array of 5-8 lowercase hashtags without the # symbol), ' +
              'viralScore (integer 0-100 estimating how likely this clip is to go viral), ' +
              'platform (one of "tiktok", "instagram_reels", "youtube_shorts" - whichever fits best), and ' +
              'selectionReason (one sentence explaining why this moment was chosen as a highlight).',
          },
          { role: 'user', content: clipText.slice(0, 4000) },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) return fallback;

      const parsed = JSON.parse(raw) as {
        hookVariations?: Partial<Record<HookCategory, unknown>>;
        description?: unknown;
        hashtags?: unknown;
        viralScore?: unknown;
        platform?: unknown;
        selectionReason?: unknown;
      };

      const hookVariations = this.normalizeHookVariations(parsed.hookVariations, fallback.hookVariations);

      return {
        hookTitles: this.pickTopHooks(hookVariations),
        hookVariations,
        description: typeof parsed.description === 'string' ? parsed.description : fallback.description,
        hashtags:
          Array.isArray(parsed.hashtags) && parsed.hashtags.length
            ? parsed.hashtags.slice(0, 8).map(String)
            : fallback.hashtags,
        viralScore:
          typeof parsed.viralScore === 'number' && Number.isFinite(parsed.viralScore)
            ? Math.max(0, Math.min(100, Math.round(parsed.viralScore)))
            : fallback.viralScore,
        platform: typeof parsed.platform === 'string' ? parsed.platform : fallback.platform,
        selectionReason:
          typeof parsed.selectionReason === 'string' ? parsed.selectionReason : fallback.selectionReason,
      };
    } catch (err) {
      this.logger.warn(`Viral metadata generation failed, using fallback: ${(err as Error).message}`);
      return fallback;
    }
  }

  /** Flattens the grouped hook variations into a top-picks list (one per category, best first). */
  private pickTopHooks(hookVariations: HookVariations): string[] {
    return HOOK_CATEGORIES.map((category) => hookVariations[category]?.[0]).filter((title): title is string => !!title);
  }

  private normalizeHookVariations(
    raw: Partial<Record<HookCategory, unknown>> | undefined,
    fallback: HookVariations,
  ): HookVariations {
    const result: HookVariations = { curiosity: [], authority: [], shock: [], storytelling: [] };

    for (const category of HOOK_CATEGORIES) {
      const value = raw?.[category];
      result[category] =
        Array.isArray(value) && value.length ? value.slice(0, 3).map(String) : fallback[category];
    }

    return result;
  }

  private fallback(clipText: string, heuristicScore: number, heuristicReason: string): ViralMetadata {
    const firstSentence = clipText.split(/[.!?]/)[0]?.trim().slice(0, 80) || 'this moment';

    const hookVariations: HookVariations = {
      curiosity: [
        `Why nobody talks about ${firstSentence.toLowerCase()}`,
        "The part everyone skips (but shouldn't)",
      ],
      authority: [
        `What most people get wrong about ${firstSentence.toLowerCase()}`,
        'The #1 lesson from this clip',
      ],
      shock: ["You won't believe what happens next...", 'This changes everything'],
      storytelling: [`The moment ${firstSentence.toLowerCase()}`, 'Here\'s exactly how it happened'],
    };

    return {
      hookTitles: this.pickTopHooks(hookVariations),
      hookVariations,
      description: clipText.slice(0, 200),
      hashtags: ['viral', 'shorts', 'fyp', 'trending', 'clips'],
      viralScore: Math.max(1, Math.round(heuristicScore * 100)),
      platform: 'tiktok',
      selectionReason: heuristicReason,
    };
  }
}
