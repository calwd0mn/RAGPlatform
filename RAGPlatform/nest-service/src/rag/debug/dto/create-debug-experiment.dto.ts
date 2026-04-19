import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CHUNK_STRATEGY_TYPES,
  DEBUG_EXPERIMENT_SCOPES,
} from '../../../schemas/debug-experiment.schema';

class PromptDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  basePromptId!: string;

  @IsString()
  @MinLength(1)
  systemPrompt!: string;

  @IsString()
  @MinLength(1)
  contextTemplate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  versionLabel?: string;
}

class ChunkStrategyDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/, { message: 'name must not be empty' })
  name!: string;

  @IsIn(CHUNK_STRATEGY_TYPES)
  type!: 'recursive' | 'markdown' | 'token';

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

  @Type(() => Boolean)
  @IsBoolean()
  preserveSentenceBoundary!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  separators?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxSentenceMerge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  versionLabel?: string;
}

export class CreateDebugExperimentDto {
  @IsMongoId()
  knowledgeBaseId!: string;

  @IsOptional()
  @IsIn(DEBUG_EXPERIMENT_SCOPES)
  scope?: 'legacy' | 'manual';

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  documentIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(2000, { each: true })
  @Matches(/\S/, { each: true, message: 'query must not be empty' })
  queries!: string[];

  @ValidateNested()
  @Type(() => PromptDraftDto)
  promptDraft!: PromptDraftDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChunkStrategyDraftDto)
  chunkStrategyDrafts!: ChunkStrategyDraftDto[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK!: number;

  @IsIn(['retrieve-only', 'full-rag'])
  mode!: 'retrieve-only' | 'full-rag';
}

export class UpdateDebugExperimentDto {
  @IsOptional()
  @IsMongoId()
  knowledgeBaseId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  documentIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(2000, { each: true })
  @Matches(/\S/, { each: true, message: 'query must not be empty' })
  queries?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PromptDraftDto)
  promptDraft?: PromptDraftDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChunkStrategyDraftDto)
  chunkStrategyDrafts?: ChunkStrategyDraftDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsIn(['retrieve-only', 'full-rag'])
  mode?: 'retrieve-only' | 'full-rag';
}
