import { Injectable, NotFoundException } from '@nestjs/common';
import { AdTemplatesService } from '../ad-templates/ad-templates.service';
import { AdGenerationService } from '../common/ad-generation.service';
import { AdScript, AdStrategy } from '../common/ad-plan.types';
import { GenerateAdScriptDto } from './dto/generate-ad-script.dto';

export interface AdScriptResult {
  templateId: string;
  adStrategy: AdStrategy;
  script: AdScript;
}

/**
 * AI Ad Script Generator: produces the ad strategy + hook/problem/solution/
 * benefits/CTA script for a product, via AdGenerationService (shared with the
 * AI Product Ad Video Generator, which additionally returns the scene
 * breakdown and visual/audio/social direction).
 */
@Injectable()
export class AdScriptsService {
  constructor(
    private adTemplates: AdTemplatesService,
    private adGeneration: AdGenerationService,
  ) {}

  async generate(_userId: string, dto: GenerateAdScriptDto): Promise<AdScriptResult> {
    const template = this.adTemplates.findOne(dto.templateId);
    if (!template) {
      throw new NotFoundException(`Ad template ${dto.templateId} not found`);
    }

    const plan = await this.adGeneration.generatePlan({
      productName: dto.productName,
      productDescription: dto.productDescription,
      targetAudience: dto.targetAudience,
      tone: dto.tone,
    });

    return {
      templateId: template.id,
      adStrategy: plan.adStrategy,
      script: plan.script,
    };
  }
}
