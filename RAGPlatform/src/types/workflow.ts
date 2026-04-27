import type { RagCitation } from "./rag";

export type WorkflowNodeType =
  | "start"
  | "userInput"
  | "rag"
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

