import {
  BranchesOutlined,
  ExportOutlined,
  FileSearchOutlined,
  PlayCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { NodeTypes } from "@xyflow/react";
import type { ReactNode } from "react";
import type {
  WorkflowNodeData,
  WorkflowNodeType,
} from "../../types/workflow";
import {
  ConditionWorkflowNode,
  OutputWorkflowNode,
  RagWorkflowNode,
  StartWorkflowNode,
  UserInputWorkflowNode,
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
  if (type === "condition") {
    return {
      nodeType: "condition",
      label: "条件分支",
      conditions: [
        {
          variable: "{{rag_search.retrievedCount}}",
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

