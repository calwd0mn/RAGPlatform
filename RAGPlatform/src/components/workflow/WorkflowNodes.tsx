import {
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  FileSearchOutlined,
  FilterOutlined,
  LoadingOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Spin, Typography } from "antd";
import type { ReactNode } from "react";
import { useWorkflowEditorStore } from "../../stores/workflow-editor.store";
import type {
  WorkflowNodeData,
  WorkflowNodeExecutionStatus,
  WorkflowNodeType,
} from "../../types/workflow";
import styles from "./WorkflowNodes.module.css";

export type WorkflowFlowNode = Node<WorkflowNodeData, WorkflowNodeType>;

type WorkflowNodeViewProps = NodeProps<WorkflowFlowNode>;

interface NodeShellProps {
  label: string;
  icon: ReactNode;
  tone: string;
  status?: WorkflowNodeExecutionStatus;
  children: ReactNode;
}

function NodeShell({ label, icon, tone, status, children }: NodeShellProps) {
  const statusIcon = (() => {
    if (status === "running") {
      return <Spin indicator={<LoadingOutlined spin />} size="small" />;
    }
    if (status === "success") {
      return <CheckCircleOutlined className={styles.successIcon} />;
    }
    if (status === "failed") {
      return <ClockCircleOutlined className={styles.failedIcon} />;
    }
    if (status === "skipped") {
      return <ClockCircleOutlined className={styles.skippedIcon} />;
    }
    return null;
  })();

  return (
    <div className={styles.node} style={{ borderLeftColor: tone }}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon} style={{ color: tone }}>
          {icon}
        </span>
        <Typography.Text strong className={styles.nodeTitle}>
          {label}
        </Typography.Text>
        <span className={styles.nodeStatus}>{statusIcon}</span>
      </div>
      {children}
    </div>
  );
}

function useNodeExecutionStatus(
  id: string,
): WorkflowNodeExecutionStatus | undefined {
  return useWorkflowEditorStore((state) => state.executionStates[id]?.status);
}

function NodeMeta({ children }: { children: ReactNode }) {
  return (
    <Typography.Text type="secondary" className={styles.nodeMeta}>
      {children}
    </Typography.Text>
  );
}

function renderTopK(data: WorkflowNodeData): number {
  if (
    data.nodeType === "rag" ||
    data.nodeType === "vectorRetrieve" ||
    data.nodeType === "bm25Retrieve" ||
    data.nodeType === "rerank"
  ) {
    return data.topK;
  }
  return 5;
}

export function StartWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<PlayCircleOutlined />}
      tone="#1677ff"
      status={status}
    >
      <NodeMeta>工作流入口</NodeMeta>
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function UserInputWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  const inputField =
    data.nodeType === "userInput" ? data.inputField : "question";
  return (
    <NodeShell
      label={data.label}
      icon={<UserOutlined />}
      tone="#16a34a"
      status={status}
    >
      <NodeMeta>{inputField}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function RagWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<FileSearchOutlined />}
      tone="#d97706"
      status={status}
    >
      <NodeMeta>Top K: {renderTopK(data)}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function LlmWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  const outputMode = data.nodeType === "llm" ? data.outputMode : "text";
  return (
    <NodeShell
      label={data.label}
      icon={<RobotOutlined />}
      tone="#0f766e"
      status={status}
    >
      <NodeMeta>提示词调用 · {outputMode.toUpperCase()}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function QueryRewriteWorkflowNode({
  id,
  data,
}: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<SearchOutlined />}
      tone="#0891b2"
      status={status}
    >
      <NodeMeta>优化检索问题</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function VectorRetrieveWorkflowNode({
  id,
  data,
}: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<FileSearchOutlined />}
      tone="#d97706"
      status={status}
    >
      <NodeMeta>向量召回 · Top K: {renderTopK(data)}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function Bm25RetrieveWorkflowNode({
  id,
  data,
}: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<NodeIndexOutlined />}
      tone="#ca8a04"
      status={status}
    >
      <NodeMeta>关键词召回 · Top K: {renderTopK(data)}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function MergeResultsWorkflowNode({
  id,
  data,
}: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  const resultLimit = data.nodeType === "mergeResults" ? data.resultLimit : 8;
  return (
    <NodeShell
      label={data.label}
      icon={<ApartmentOutlined />}
      tone="#7c3aed"
      status={status}
    >
      <NodeMeta>去重合并 · 保留 {resultLimit}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function RerankWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<FilterOutlined />}
      tone="#dc2626"
      status={status}
    >
      <NodeMeta>重排候选 · Top K: {renderTopK(data)}</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function AnswerWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<ExportOutlined />}
      tone="#2563eb"
      status={status}
    >
      <NodeMeta>基于检索结果生成答案</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function ConditionWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<BranchesOutlined />}
      tone="#dc2626"
      status={status}
    >
      <NodeMeta>true / false</NodeMeta>
      <Handle type="target" position={Position.Left} />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className={styles.trueHandle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className={styles.falseHandle}
      />
    </NodeShell>
  );
}

export function OutputWorkflowNode({ id, data }: WorkflowNodeViewProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<ExportOutlined />}
      tone="#7c3aed"
      status={status}
    >
      <NodeMeta>最终输出</NodeMeta>
      <Handle type="target" position={Position.Left} />
    </NodeShell>
  );
}
