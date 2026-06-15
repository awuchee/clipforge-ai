import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CAPTION_THEMES } from '../../worker/services/caption.service';

export class CaptionWordDto {
  @IsString()
  @MaxLength(100)
  word: string;

  @IsNumber()
  start: number;

  @IsNumber()
  end: number;
}

/** Fields editable from the clip editor. Any change enqueues a re-render job. */
export class UpdateClipDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  startSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  endSec?: number;

  @IsOptional()
  @IsIn(Object.keys(CAPTION_THEMES))
  captionTheme?: string;

  @IsOptional()
  @IsInt()
  @Min(24)
  @Max(160)
  fontSize?: number;

  @IsOptional()
  @IsIn(['top', 'middle', 'bottom'])
  captionPosition?: string;

  @IsOptional()
  @IsBoolean()
  emojiEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CaptionWordDto)
  captionWords?: CaptionWordDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  hookTitles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  selectedHookTitle?: string;
}
