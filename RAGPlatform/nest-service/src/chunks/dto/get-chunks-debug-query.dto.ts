import { Type } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GetChunksDebugQueryDto {
  @IsMongoId()
  knowledgeBaseId!: string;

  @IsOptional()
  @IsMongoId()
  experimentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  strategyName?: string;

  @IsOptional()
  @IsMongoId()
  documentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query?: string;
}
