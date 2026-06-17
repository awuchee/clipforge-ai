import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AD_TEMPLATES } from '../../ad-templates/ad-templates.constants';

const TEMPLATE_IDS = AD_TEMPLATES.map((t) => t.id) as [string, ...string[]];

export class GenerateAdScriptDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  productName: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  productDescription: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsIn(TEMPLATE_IDS)
  templateId: string;
}
