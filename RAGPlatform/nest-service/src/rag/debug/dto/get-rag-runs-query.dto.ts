import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { RAG_RUN_STATUSES, RAG_RUN_TYPES, RagRunStatus, RagRunType } from '../../../schemas/rag-run.schema';

export class GetRagRunsQueryDto {
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
  @Max(500)
  offset?: number;

  @IsOptional()
  @IsIn(RAG_RUN_TYPES)
  runType?: RagRunType;

  @IsOptional()
  @IsIn(RAG_RUN_STATUSES)
  status?: RagRunStatus;
}
