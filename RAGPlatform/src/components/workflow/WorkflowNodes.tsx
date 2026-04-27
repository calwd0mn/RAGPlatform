import {
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Spin, Typography } from "antd";
import type { ReactNode } from "react";
import type {
  WorkflowNodeData,
  WorkflowNodeExecutionStatus,
  WorkflowNodeType,
} from "../../types/workflow";
import styles from "./WorkflowNodes.module.css";

export type WorkflowFlowNode = Node<WorkflowNodeData, WorkflowNodeType>;

interface WorkflowNodeProps extends NodeProps<WorkflowFlowNode> {
  data: WorkflowNodeData & {
    executionStatus?: WorkflowNodeExecutionStatus;
  };
}

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

export function StartWorkflowNode({ data }: WorkflowNodeProps) {
  return (
    <NodeShell
      label={data.label}
      icon={<PlayCircleOutlined />}
      tone="#1677ff"
      status={data.executionStatus}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        工作流入口
      </Typography.Text>
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function UserInputWorkflowNode({ data }: WorkflowNodeProps) {
  const inputField =
    data.nodeType === "userInput" ? data.inputField : "question";
  return (
    <NodeShell
      label={data.label}
      icon={<UserOutlined />}
      tone="#16a34a"
      status={data.executionStatus}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        {inputField}
      </Typography.Text>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function RagWorkflowNode({ data }: WorkflowNodeProps) {
  const topK = data.nodeType === "rag" ? data.topK : 5;
  return (
    <NodeShell
      label={data.label}
      icon={<FileSearchOutlined />}
      tone="#d97706"
      status={data.executionStatus}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        Top K: {topK}
      </Typography.Text>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function ConditionWorkflowNode({ data }: WorkflowNodeProps) {
  return (
    <NodeShell
      label={data.label}
      icon={<BranchesOutlined />}
      tone="#dc2626"
      status={data.executionStatus}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        true / false
      </Typography.Text>
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

export function OutputWorkflowNode({ data }: WorkflowNodeProps) {
  return (
    <NodeShell
      label={data.label}
      icon={<ExportOutlined />}
      tone="#7c3aed"
      status={data.executionStatus}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        最终答案
      </Typography.Text>
      <Handle type="target" position={Position.Left} />
    </NodeShell>
  );
}

