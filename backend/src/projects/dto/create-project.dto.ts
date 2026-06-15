import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { SourceType } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsEnum(SourceType)
  sourceType: SourceType;

  @ValidateIf((dto) => dto.sourceType === SourceType.YOUTUBE)
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;
}
