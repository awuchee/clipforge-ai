import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { AD_TEMPLATES } from '../../ad-templates/ad-templates.constants';

const TEMPLATE_IDS = AD_TEMPLATES.map((t) => t.id) as [string, ...string[]];

export class CreateAdProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  productName: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  productDescription: string;

  @IsIn(TEMPLATE_IDS)
  templateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  /** Optional product images/screenshots used as scene backgrounds for the rendered video. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  productImageUrls?: string[];
}
