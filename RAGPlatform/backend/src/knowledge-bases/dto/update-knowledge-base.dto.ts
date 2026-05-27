import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class UpdateKnowledgeBaseChunkStrategyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  version?: string;

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(8000)
  chunkSize!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4000)
  chunkOverlap!: number;

  @IsOptional()
  @IsIn(['recursive', 'markdown', 'token'])
  splitterType?: 'recursive' | 'markdown' | 'token';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  preserveSentenceBoundary?: boolean;
}

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  clearActiveChunkStrategy?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateKnowledgeBaseChunkStrategyDto)
  chunkStrategy?: UpdateKnowledgeBaseChunkStrategyDto;
}
