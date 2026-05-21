import type { RagCitation } from "./rag";

export type WorkflowNodeType =
  | "start"
  | "userInput"
  | "rag"
  | "llm"
  | "queryRewrite"
  | "vectorRetrieve"
  | "bm25Retrieve"
  | "mergeResults"
  | "rerank"
  | "answer"
  | "condition"
  | "output";

export type WorkflowConditionOperator =
  | "==="
  | "!=="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains";

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowBaseNodeData extends Record<string, unknown> {
  label: string;
  nodeType: WorkflowNodeType;
}

export interface WorkflowStartNodeData extends WorkflowBaseNodeData {
  nodeType: "start";
}

export interface WorkflowUserInputNodeData extends WorkflowBaseNodeData {
  nodeType: "userInput";
  inputField: string;
}

export interface WorkflowRagNodeData extends WorkflowBaseNodeData {
  nodeType: "rag";
  query: string;
  topK: number;
}

export type WorkflowLlmOutputMode = "text" | "json";

export interface WorkflowLlmNodeData extends WorkflowBaseNodeData {
  nodeType: "llm";
  systemPrompt: string;
  userPromptTemplate: string;
  outputMode: WorkflowLlmOutputMode;
}

export interface WorkflowQueryRewriteNodeData extends WorkflowBaseNodeData {
  nodeType: "queryRewrite";
  query: string;
}

export interface WorkflowVectorRetrieveNodeData extends WorkflowBaseNodeData {
  nodeType: "vectorRetrieve";
  query: string;
  topK: number;
}

export interface WorkflowBm25RetrieveNodeData extends WorkflowBaseNodeData {
  nodeType: "bm25Retrieve";
  query: string;
  topK: number;
}

export interface WorkflowMergeResultsNodeData extends WorkflowBaseNodeData {
  nodeType: "mergeResults";
  resultLimit: number;
}

export interface WorkflowRerankNodeData extends WorkflowBaseNodeData {
  nodeType: "rerank";
  query: string;
  topK: number;
}

export interface WorkflowAnswerNodeData extends WorkflowBaseNodeData {
  nodeType: "answer";
  question: string;
}

export interface WorkflowConditionItem {
  variable: string;
  operator: WorkflowConditionOperator;
  value: string | number | boolean;
}

export interface WorkflowConditionNodeData extends WorkflowBaseNodeData {
  nodeType: "condition";
  conditions: WorkflowConditionItem[];
}

export interface WorkflowOutputNodeData extends WorkflowBaseNodeData {
  nodeType: "output";
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
  sourceHandle?: "true" | "false";
}

export interface WorkflowRecord {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export type WorkflowInputValue =
  | string
  | number
  | boolean
  | null
  | WorkflowInputValue[]
  | { [key: string]: WorkflowInputValue };

export type WorkflowRunInputs = Record<string, WorkflowInputValue>;

export type WorkflowNodeExecutionStatus =
  | "running"
  | "success"
  | "failed"
  | "skipped";

export interface WorkflowNodeExecution {
  nodeId: string;
  status: WorkflowNodeExecutionStatus;
  output?: WorkflowInputValue | Record<string, unknown>;
  error?: string;
}

export interface WorkflowRunFinal {
  output: string;
  context: Record<string, unknown>;
}

export type WorkflowStreamEvent =
  | {
      event: "node_status";
      data: WorkflowNodeExecution;
    }
  | {
      event: "final";
      data: WorkflowRunFinal;
    }
  | {
      event: "error";
      data: { message: string };
    };

export interface WorkflowRagNodeOutput {
  query: string;
  topK: number;
  retrievedCount: number;
  retrievalProvider: string;
  citations: RagCitation[];
}

export interface WorkflowQueryRewriteNodeOutput {
  originalQuery: string;
  rewrittenQuery: string;
  model: string;
}

export interface WorkflowLlmNodeOutput {
  text: string;
  json: Record<string, WorkflowInputValue> | null;
  model: string;
  outputMode: WorkflowLlmOutputMode;
  citations?: RagCitation[];
}

