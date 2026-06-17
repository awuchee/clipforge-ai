import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AdAudioDirection,
  AdScene,
  AdScript,
  AdSocialOutput,
  AdStrategy,
  AdVideoPlan,
  AdVisualDirection,
  GenerateAdPlanInput,
} from './ad-plan.types';

const SYSTEM_PROMPT = `You are VixClip AI Ad Video Generator.

You convert any product, service, or idea into a complete short-form advertising video plan optimized for TikTok, Instagram Reels, and YouTube Shorts.

Your output must be structured, deterministic, and ready for video rendering pipelines.

Return a structured JSON object ONLY, with this exact shape (no extra top-level keys, no explanations, no markdown):

{
  "adStrategy": {
    "targetAudience": string,
    "coreMessage": string,
    "emotionalAngle": string,
    "conversionGoal": string
  },
  "script": {
    "hook": string,        // 0-3s
    "problem": string,     // 3-8s
    "solution": string,    // 8-15s
    "benefits": string,    // 15-25s
    "callToAction": string // last 3-5s
  },
  "scenes": [
    {
      "sceneNumber": integer,
      "durationSeconds": number,
      "visualDescription": string,
      "onScreenText": string,
      "voiceover": string,
      "transitionType": "cut" | "fade" | "zoom" | "whip_pan" | "slide"
    }
  ],
  "visualDirection": {
    "cameraStyle": string,
    "motionStyle": string,
    "background": string,
    "productFocus": string
  },
  "audioDirection": {
    "voiceTone": string,
    "voiceGenderSuggestion": string,
    "musicMood": string,
    "pacing": string
  },
  "socialOutput": {
    "tiktokCaption": string,
    "instagramCaption": string,
    "youtubeCaption": string,
    "hashtags": string[] // SEO-optimized, lowercase, no "#" symbol
  }
}

Rules:
- No hallucinated facts - only use details given about the product/service/idea.
- The script must follow the strict hook/problem/solution/benefits/callToAction flow with the timings noted above.
- The scene breakdown should cover the full script (typically 4-6 scenes spanning ~25-30 seconds total) and be detailed enough to drive an automated video render.
- Always optimize for conversion and short-form viral pacing.
- Return ONLY the JSON object.`;

/**
 * Shared generation core for the AI Ad Script Generator and AI Product Ad
 * Video Generator. Produces a full structured ad video plan (strategy,
 * script, scene breakdown, visual/audio direction, social captions) from a
 * product description via GPT, with a deterministic offline fallback when
 * `OPENAI_API_KEY` is not configured or the API call fails.
 */
@Injectable()
export class AdGenerationService {
  private readonly logger = new Logger(AdGenerationService.name);
  private readonly client?: OpenAI;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async generatePlan(input: GenerateAdPlanInput): Promise<AdVideoPlan> {
    const fallback = this.fallback(input);
    if (!this.client) return fallback;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.8,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              product: input.productName,
              description: input.productDescription,
              targetAudience: input.targetAudience ?? 'general audience',
              tone: input.tone ?? 'energetic',
            }),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) return fallback;

      return this.normalizePlan(JSON.parse(raw), fallback);
    } catch (err) {
      this.logger.warn(`Ad plan generation failed, using fallback: ${(err as Error).message}`);
      return fallback;
    }
  }

  /** Merges a parsed (and possibly partial/malformed) model response onto the fallback plan. */
  private normalizePlan(raw: unknown, fallback: AdVideoPlan): AdVideoPlan {
    const parsed = (raw ?? {}) as Partial<Record<keyof AdVideoPlan, unknown>>;

    return {
      adStrategy: this.normalizeStrategy(parsed.adStrategy, fallback.adStrategy),
      script: this.normalizeScript(parsed.script, fallback.script),
      scenes: this.normalizeScenes(parsed.scenes, fallback.scenes),
      visualDirection: this.normalizeVisualDirection(parsed.visualDirection, fallback.visualDirection),
      audioDirection: this.normalizeAudioDirection(parsed.audioDirection, fallback.audioDirection),
      socialOutput: this.normalizeSocialOutput(parsed.socialOutput, fallback.socialOutput),
    };
  }

  private normalizeStrategy(raw: unknown, fallback: AdStrategy): AdStrategy {
    const v = (raw ?? {}) as Partial<AdStrategy>;
    return {
      targetAudience: this.str(v.targetAudience, fallback.targetAudience),
      coreMessage: this.str(v.coreMessage, fallback.coreMessage),
      emotionalAngle: this.str(v.emotionalAngle, fallback.emotionalAngle),
      conversionGoal: this.str(v.conversionGoal, fallback.conversionGoal),
    };
  }

  private normalizeScript(raw: unknown, fallback: AdScript): AdScript {
    const v = (raw ?? {}) as Partial<AdScript>;
    return {
      hook: this.str(v.hook, fallback.hook),
      problem: this.str(v.problem, fallback.problem),
      solution: this.str(v.solution, fallback.solution),
      benefits: this.str(v.benefits, fallback.benefits),
      callToAction: this.str(v.callToAction, fallback.callToAction),
    };
  }

  private normalizeScenes(raw: unknown, fallback: AdScene[]): AdScene[] {
    if (!Array.isArray(raw) || raw.length === 0) return fallback;

    const transitions: AdScene['transitionType'][] = ['cut', 'fade', 'zoom', 'whip_pan', 'slide'];

    const scenes = raw
      .map((entry, index): AdScene | null => {
        const v = (entry ?? {}) as Partial<AdScene>;
        if (typeof v.visualDescription !== 'string' && typeof v.voiceover !== 'string') return null;

        return {
          sceneNumber: typeof v.sceneNumber === 'number' ? v.sceneNumber : index + 1,
          durationSeconds:
            typeof v.durationSeconds === 'number' && v.durationSeconds > 0 ? v.durationSeconds : 5,
          visualDescription: this.str(v.visualDescription, 'Product in use.'),
          onScreenText: this.str(v.onScreenText, ''),
          voiceover: this.str(v.voiceover, ''),
          transitionType: transitions.includes(v.transitionType as AdScene['transitionType'])
            ? (v.transitionType as AdScene['transitionType'])
            : 'cut',
        };
      })
      .filter((scene): scene is AdScene => scene !== null);

    return scenes.length ? scenes : fallback;
  }

  private normalizeVisualDirection(raw: unknown, fallback: AdVisualDirection): AdVisualDirection {
    const v = (raw ?? {}) as Partial<AdVisualDirection>;
    return {
      cameraStyle: this.str(v.cameraStyle, fallback.cameraStyle),
      motionStyle: this.str(v.motionStyle, fallback.motionStyle),
      background: this.str(v.background, fallback.background),
      productFocus: this.str(v.productFocus, fallback.productFocus),
    };
  }

  private normalizeAudioDirection(raw: unknown, fallback: AdAudioDirection): AdAudioDirection {
    const v = (raw ?? {}) as Partial<AdAudioDirection>;
    return {
      voiceTone: this.str(v.voiceTone, fallback.voiceTone),
      voiceGenderSuggestion: this.str(v.voiceGenderSuggestion, fallback.voiceGenderSuggestion),
      musicMood: this.str(v.musicMood, fallback.musicMood),
      pacing: this.str(v.pacing, fallback.pacing),
    };
  }

  private normalizeSocialOutput(raw: unknown, fallback: AdSocialOutput): AdSocialOutput {
    const v = (raw ?? {}) as Partial<AdSocialOutput>;
    return {
      tiktokCaption: this.str(v.tiktokCaption, fallback.tiktokCaption),
      instagramCaption: this.str(v.instagramCaption, fallback.instagramCaption),
      youtubeCaption: this.str(v.youtubeCaption, fallback.youtubeCaption),
      hashtags:
        Array.isArray(v.hashtags) && v.hashtags.length
          ? v.hashtags.slice(0, 10).map(String)
          : fallback.hashtags,
    };
  }

  private str(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  /** Deterministic offline plan used when OPENAI_API_KEY is not configured or the API call fails. */
  private fallback(input: GenerateAdPlanInput): AdVideoPlan {
    const { productName, productDescription } = input;
    const audience = input.targetAudience || 'people who could benefit from this product';
    const tone = input.tone || 'energetic';

    return {
      adStrategy: {
        targetAudience: audience,
        coreMessage: `${productName} solves a real problem for ${audience}.`,
        emotionalAngle: `${tone} - relief and excitement at finding a better way`,
        conversionGoal: 'Drive clicks to the product page / link in bio',
      },
      script: {
        hook: `Stop scrolling if you've ever struggled with this...`,
        problem: `Most people waste time and money before finding ${productName}.`,
        solution: `${productName}: ${productDescription.slice(0, 160)}`,
        benefits: `Fast, simple, and built for ${audience}.`,
        callToAction: `Try ${productName} today - link in bio.`,
      },
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 3,
          visualDescription: 'Close-up hook shot grabbing attention, bold on-screen text.',
          onScreenText: 'Stop scrolling...',
          voiceover: `Stop scrolling if you've ever struggled with this...`,
          transitionType: 'cut',
        },
        {
          sceneNumber: 2,
          durationSeconds: 5,
          visualDescription: 'Relatable problem shown in everyday context.',
          onScreenText: 'The problem',
          voiceover: `Most people waste time and money before finding ${productName}.`,
          transitionType: 'fade',
        },
        {
          sceneNumber: 3,
          durationSeconds: 7,
          visualDescription: `Product reveal and demo of ${productName} in use.`,
          onScreenText: productName,
          voiceover: `${productName}: ${productDescription.slice(0, 120)}`,
          transitionType: 'zoom',
        },
        {
          sceneNumber: 4,
          durationSeconds: 10,
          visualDescription: 'Quick montage of benefits/results.',
          onScreenText: 'Why it works',
          voiceover: `Fast, simple, and built for ${audience}.`,
          transitionType: 'whip_pan',
        },
        {
          sceneNumber: 5,
          durationSeconds: 4,
          visualDescription: 'Product shot with logo and call-to-action overlay.',
          onScreenText: `Try ${productName} - link in bio`,
          voiceover: `Try ${productName} today - link in bio.`,
          transitionType: 'cut',
        },
      ],
      visualDirection: {
        cameraStyle: 'Handheld, close-up, smartphone-native framing',
        motionStyle: 'Fast cuts with quick zooms and whip pans',
        background: 'Clean, well-lit, realistic everyday setting',
        productFocus: `${productName} kept in frame and clearly visible in every scene`,
      },
      audioDirection: {
        voiceTone: tone,
        voiceGenderSuggestion: 'either',
        musicMood: 'upbeat, trending, high-energy',
        pacing: 'fast - short-form viral pacing, no dead air',
      },
      socialOutput: {
        tiktokCaption: `${productName} changed the game 👀 #fyp`,
        instagramCaption: `Meet ${productName} - the easier way to get results.`,
        youtubeCaption: `${productName}: ${productDescription.slice(0, 100)}`,
        hashtags: ['fyp', 'viral', 'musthave', productName.toLowerCase().replace(/\s+/g, ''), 'shopnow'],
      },
    };
  }
}
