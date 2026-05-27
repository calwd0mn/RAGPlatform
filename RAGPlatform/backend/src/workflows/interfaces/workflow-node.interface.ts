import { RagCitation } from '../../rag/interfaces/rag-citation.interface';
import { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';

export type WorkflowNodeType =
  | 'start'
  | 'userInput'
  | 'rag'
  | 'llm'
  | 'queryRewrite'
  | 'vectorRetrieve'
  | 'bm25Retrieve'
  | 'mergeResults'
  | 'rerank'
  | 'answer'
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

export type WorkflowLlmOutputMode = 'text' | 'json';

export interface WorkflowLlmNodeData extends WorkflowBaseNodeData {
  nodeType: 'llm';
  systemPrompt: string;
  userPromptTemplate: string;
  outputMode: WorkflowLlmOutputMode;
}

export interface WorkflowQueryRewriteNodeData extends WorkflowBaseNodeData {
  nodeType: 'queryRewrite';
  query: string;
}

export interface WorkflowVectorRetrieveNodeData extends WorkflowBaseNodeData {
  nodeType: 'vectorRetrieve';
  query: string;
  topK: number;
}

export interface WorkflowBm25RetrieveNodeData extends WorkflowBaseNodeData {
  nodeType: 'bm25Retrieve';
  query: string;
  topK: number;
}

export interface WorkflowMergeResultsNodeData extends WorkflowBaseNodeData {
  nodeType: 'mergeResults';
  resultLimit: number;
}

export interface WorkflowRerankNodeData extends WorkflowBaseNodeData {
  nodeType: 'rerank';
  query: string;
  topK: number;
}

export interface WorkflowAnswerNodeData extends WorkflowBaseNodeData {
  nodeType: 'answer';
  question: string;
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
  | WorkflowLlmNodeData
  | WorkflowQueryRewriteNodeData
  | WorkflowVectorRetrieveNodeData
  | WorkflowBm25RetrieveNodeData
  | WorkflowMergeResultsNodeData
  | WorkflowRerankNodeData
  | WorkflowAnswerNodeData
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

export interface WorkflowQueryRewriteOutput {
  originalQuery: string;
  rewrittenQuery: string;
  model: string;
}

export interface WorkflowLlmOutput {
  text: string;
  json: Record<string, WorkflowInputValue> | null;
  model: string;
  outputMode: WorkflowLlmOutputMode;
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
  | WorkflowLlmOutput
  | WorkflowQueryRewriteOutput
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

