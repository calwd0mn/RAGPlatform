import { IsMongoId } from 'class-validator';

export class WorkflowIdParamDto {
  @IsMongoId()
  workflowId!: string;
}
