import {
  ApartmentOutlined,
  BranchesOutlined,
  ExportOutlined,
  FileSearchOutlined,
  FilterOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { NodeTypes } from "@xyflow/react";
import type { ReactNode } from "react";
import type {
  WorkflowNodeData,
  WorkflowNodeType,
} from "../../types/workflow";
import {
  AnswerWorkflowNode,
  Bm25RetrieveWorkflowNode,
  ConditionWorkflowNode,
  LlmWorkflowNode,
  MergeResultsWorkflowNode,
  OutputWorkflowNode,
  QueryRewriteWorkflowNode,
  RagWorkflowNode,
  RerankWorkflowNode,
  StartWorkflowNode,
  UserInputWorkflowNode,
  VectorRetrieveWorkflowNode,
} from "./WorkflowNodes";

export const WORKFLOW_NODE_CATALOG = [
  {
    type: "start",
    label: "开始",
    icon: <PlayCircleOutlined />,
  },
  {
    type: "userInput",
    label: "用户输入",
    icon: <UserOutlined />,
  },
  {
    type: "rag",
    label: "RAG 检索",
    icon: <FileSearchOutlined />,
  },
  {
    type: "llm",
    label: "LLM 调用",
    icon: <RobotOutlined />,
  },
  {
    type: "queryRewrite",
    label: "问题优化",
    icon: <SearchOutlined />,
  },
  {
    type: "vectorRetrieve",
    label: "向量检索",
    icon: <FileSearchOutlined />,
  },
  {
    type: "bm25Retrieve",
    label: "BM25 检索",
    icon: <NodeIndexOutlined />,
  },
  {
    type: "mergeResults",
    label: "结果合并",
    icon: <ApartmentOutlined />,
  },
  {
    type: "rerank",
    label: "结果重排",
    icon: <FilterOutlined />,
  },
  {
    type: "answer",
    label: "答案生成",
    icon: <ExportOutlined />,
  },
  {
    type: "condition",
    label: "条件分支",
    icon: <BranchesOutlined />,
  },
  {
    type: "output",
    label: "输出",
    icon: <ExportOutlined />,
  },
] satisfies Array<{ type: WorkflowNodeType; label: string; icon: ReactNode }>;

export const workflowReactNodeTypes = {
  start: StartWorkflowNode,
  userInput: UserInputWorkflowNode,
  rag: RagWorkflowNode,
  llm: LlmWorkflowNode,
  queryRewrite: QueryRewriteWorkflowNode,
  vectorRetrieve: VectorRetrieveWorkflowNode,
  bm25Retrieve: Bm25RetrieveWorkflowNode,
  mergeResults: MergeResultsWorkflowNode,
  rerank: RerankWorkflowNode,
  answer: AnswerWorkflowNode,
  condition: ConditionWorkflowNode,
  output: OutputWorkflowNode,
} satisfies NodeTypes;

export function createWorkflowNodeData(
  type: WorkflowNodeType,
): WorkflowNodeData {
  if (type === "start") {
    return { nodeType: "start", label: "开始" };
  }
  if (type === "userInput") {
    return { nodeType: "userInput", label: "用户输入", inputField: "question" };
  }
  if (type === "rag") {
    return {
      nodeType: "rag",
      label: "RAG 检索",
      query: "{{user_input.value}}",
      topK: 5,
    };
  }
  if (type === "llm") {
    return {
      nodeType: "llm",
      label: "LLM 调用",
      systemPrompt: "你是一个严谨的检索助手。",
      userPromptTemplate:
        "请把下面的问题改写成更适合检索的查询，保留原意，不要回答问题，只输出改写后的问题：\n{{user_input.value}}",
      outputMode: "text",
    };
  }
  if (type === "queryRewrite") {
    return {
      nodeType: "queryRewrite",
      label: "问题优化",
      query: "{{user_input.value}}",
    };
  }
  if (type === "vectorRetrieve") {
    return {
      nodeType: "vectorRetrieve",
      label: "向量检索",
      query: "{{llm_rewrite.text}}",
      topK: 5,
    };
  }
  if (type === "bm25Retrieve") {
    return {
      nodeType: "bm25Retrieve",
      label: "BM25 检索",
      query: "{{llm_rewrite.text}}",
      topK: 5,
    };
  }
  if (type === "mergeResults") {
    return {
      nodeType: "mergeResults",
      label: "结果合并",
      resultLimit: 8,
    };
  }
  if (type === "rerank") {
    return {
      nodeType: "rerank",
      label: "结果重排",
      query: "{{llm_rewrite.text}}",
      topK: 5,
    };
  }
  if (type === "answer") {
    return {
      nodeType: "answer",
      label: "答案生成",
      question: "{{user_input.value}}",
    };
  }
  if (type === "condition") {
    return {
      nodeType: "condition",
      label: "条件分支",
      conditions: [
        {
          variable: "{{rerank.retrievedCount}}",
          operator: ">",
          value: 0,
        },
      ],
    };
  }
  return {
    nodeType: "output",
    label: "输出",
    outputValue: "{{user_input.value}}",
  };
}
