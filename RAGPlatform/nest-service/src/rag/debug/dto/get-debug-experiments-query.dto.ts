import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { DEBUG_EXPERIMENT_STATUSES } from '../../../schemas/debug-experiment.schema';

export class GetDebugExperimentsQueryDto {
  @IsMongoId()
  knowledgeBaseId!: string;

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
  @IsIn(DEBUG_EXPERIMENT_STATUSES)
  status?: 'draft' | 'running' | 'completed' | 'failed' | 'published';
}
