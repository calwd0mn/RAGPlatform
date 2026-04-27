import { RagCitation } from '../../rag/interfaces/rag-citation.interface';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';

export type WorkflowNodeType =
  | 'start'
  | 'userInput'
  | 'rag'
  | 'condition'
  | 'output';

export type WorkflowConditionOperator =
  | '==='
  | '!=='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'contains';

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowBaseNodeData {
  label: string;
}

export interface WorkflowStartNodeData extends WorkflowBaseNodeData {
  nodeType: 'start';
}

export interface WorkflowUserInputNodeData extends WorkflowBaseNodeData {
  nodeType: 'userInput';
  inputField: string;
}

export interface WorkflowRagNodeData extends WorkflowBaseNodeData {
  nodeType: 'rag';
  query: string;
  topK: number;
}

export interface WorkflowConditionItem {
  variable: string;
  operator: WorkflowConditionOperator;
  value: string | number | boolean;
}

export interface WorkflowConditionNodeData extends WorkflowBaseNodeData {
  nodeType: 'condition';
  conditions: WorkflowConditionItem[];
}

export interface WorkflowOutputNodeData extends WorkflowBaseNodeData {
  nodeType: 'output';
  outputValue: string;
}

export type WorkflowNodeData =
  | WorkflowStartNodeData
  | WorkflowUserInputNodeData
  | WorkflowRagNodeData
  | WorkflowConditionNodeData
  | WorkflowOutputNodeData;

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowPosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false';
}

export interface WorkflowResponse {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export type WorkflowInputValue =
  | string
  | number
  | boolean
  | null
  | WorkflowInputValue[]
  | { [key: string]: WorkflowInputValue };

export type WorkflowRunInputs = Record<string, WorkflowInputValue>;

export interface WorkflowStartOutput {
  started: boolean;
}

export interface WorkflowUserInputOutput {
  field: string;
  value: WorkflowInputValue;
}

export interface WorkflowRagOutput {
  query: string;
  topK: number;
  retrievedCount: number;
  retrievalProvider: string;
  chunks: RetrievedChunk[];
  citations: RagCitation[];
}

export interface WorkflowConditionOutput {
  result: boolean;
}

export interface WorkflowOutputNodeOutput {
  finalOutput: string;
  citations: RagCitation[];
}

export type WorkflowNodeOutput =
  | WorkflowStartOutput
  | WorkflowUserInputOutput
  | WorkflowRagOutput
  | WorkflowConditionOutput
  | WorkflowOutputNodeOutput;

export type WorkflowExecutionContext = Record<string, WorkflowNodeOutput>;

export type WorkflowNodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

