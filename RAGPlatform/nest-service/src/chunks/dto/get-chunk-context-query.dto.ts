import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class GetChunkContextQueryDto {
  @IsMongoId()
  knowledgeBaseId!: string;

  @IsOptional()
  @IsMongoId()
  experimentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  before?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  after?: number;
}
