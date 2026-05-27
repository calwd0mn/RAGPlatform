import { IsObject } from 'class-validator';
import { WorkflowRunInputs } from '../interfaces/workflow-node.interface';

export class RunWorkflowDto {
  @IsObject()
  inputs!: WorkflowRunInputs;
}
