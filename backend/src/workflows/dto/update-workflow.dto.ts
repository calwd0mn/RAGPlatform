import {
  IsArray,
  Allow,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WorkflowConditionOperator,
  WorkflowNodeType,
} from '../interfaces/workflow-node.interface';

const WORKFLOW_NODE_TYPES: WorkflowNodeType[] = [
  'start',
  'userInput',
  'rag',
  'llm',
  'queryRewrite',
  'vectorRetrieve',
  'bm25Retrieve',
  'mergeResults',
  'rerank',
  'answer',
  'condition',
  'output',
];

const CONDITION_OPERATORS: WorkflowConditionOperator[] = [
  '===',
  '!==',
  '>',
  '<',
  '>=',
  '<=',
  'contains',
];

class WorkflowPositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

class WorkflowConditionItemDto {
  @IsString()
  variable!: string;

  @IsIn(CONDITION_OPERATORS)
  operator!: WorkflowConditionOperator;

  @Allow()
  value!: string | number | boolean;
}

class WorkflowNodeDataDto {
  @IsString()
  label!: string;

  @IsIn(WORKFLOW_NODE_TYPES)
  nodeType!: WorkflowNodeType;

  @IsOptional()
  @IsString()
  inputField?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  userPromptTemplate?: string;

  @IsOptional()
  @IsIn(['text', 'json'])
  outputMode?: 'text' | 'json';

  @IsOptional()
  @IsNumber()
  topK?: number;

  @IsOptional()
  @IsNumber()
  resultLimit?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowConditionItemDto)
  conditions?: WorkflowConditionItemDto[];

  @IsOptional()
  @IsString()
  outputValue?: string;

  @IsOptional()
  @IsString()
  question?: string;
}

class WorkflowNodeDto {
  @IsString()
  id!: string;

  @IsIn(WORKFLOW_NODE_TYPES)
  type!: WorkflowNodeType;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowPositionDto)
  position!: WorkflowPositionDto;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowNodeDataDto)
  data!: WorkflowNodeDataDto;
}

class WorkflowEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  sourceHandle?: 'true' | 'false';
}

export class UpdateWorkflowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges!: WorkflowEdgeDto[];
}
