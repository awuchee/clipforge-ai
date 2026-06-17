export interface AdStrategy {
  targetAudience: string;
  coreMessage: string;
  emotionalAngle: string;
  conversionGoal: string;
}

export interface AdScript {
  hook: string;
  problem: string;
  solution: string;
  benefits: string;
  callToAction: string;
}

export type TransitionType = 'cut' | 'fade' | 'zoom' | 'whip_pan' | 'slide';

export interface AdScene {
  sceneNumber: number;
  durationSeconds: number;
  visualDescription: string;
  onScreenText: string;
  voiceover: string;
  transitionType: TransitionType;
}

export interface AdVisualDirection {
  cameraStyle: string;
  motionStyle: string;
  background: string;
  productFocus: string;
}

export interface AdAudioDirection {
  voiceTone: string;
  voiceGenderSuggestion: string;
  musicMood: string;
  pacing: string;
}

export interface AdSocialOutput {
  tiktokCaption: string;
  instagramCaption: string;
  youtubeCaption: string;
  hashtags: string[];
}

/** Full structured ad video plan returned by AdGenerationService.generatePlan. */
export interface AdVideoPlan {
  adStrategy: AdStrategy;
  script: AdScript;
  scenes: AdScene[];
  visualDirection: AdVisualDirection;
  audioDirection: AdAudioDirection;
  socialOutput: AdSocialOutput;
}

export interface GenerateAdPlanInput {
  productName: string;
  productDescription: string;
  targetAudience?: string;
  tone?: string;
}
