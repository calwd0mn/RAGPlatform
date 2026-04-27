import { IsMongoId } from 'class-validator';

export class GetCurrentWorkflowQueryDto {
  @IsMongoId()
  knowledgeBaseId!: string;
}

