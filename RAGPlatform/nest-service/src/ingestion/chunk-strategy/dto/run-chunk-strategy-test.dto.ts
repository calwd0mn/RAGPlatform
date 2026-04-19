import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
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
  CHUNK_SPLITTER_TYPES,
  CHUNK_STRATEGY_TEST_MODES,
  ChunkSplitterType,
} from '../chunk-strategy.types';

class ChunkStrategyDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/, { message: 'name must not be empty' })
  name!: string;

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
  @IsIn(CHUNK_SPLITTER_TYPES)
  splitterType?: ChunkSplitterType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  preserveSentenceBoundary?: boolean;

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

export class RunChunkStrategyTestDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  documentIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(2000, { each: true })
  @Matches(/\S/, { each: true, message: 'query must not be empty' })
  queries!: string[];

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ChunkStrategyDefinitionDto)
  strategies!: ChunkStrategyDefinitionDto[];

  @IsIn(CHUNK_STRATEGY_TEST_MODES)
  mode!: 'retrieve-only' | 'full-rag';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
