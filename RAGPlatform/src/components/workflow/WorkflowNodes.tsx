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
import { useWorkflowEditorStore } from "../../stores/workflow-editor.store";
import type {
  WorkflowNodeData,
  WorkflowNodeExecutionStatus,
  WorkflowNodeType,
} from "../../types/workflow";
import styles from "./WorkflowNodes.module.css";

export type WorkflowFlowNode = Node<WorkflowNodeData, WorkflowNodeType>;

type WorkflowNodeProps = NodeProps<WorkflowFlowNode>;

interface NodeShellProps {
  label: string;
  icon: ReactNode;
  tone: string;
  status?: WorkflowNodeExecutionStatus;
  children: ReactNode;
}


// 节点外壳
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

// get Node Execution Status from zustand baseed on nodeId
function useNodeExecutionStatus(
  id: string,
): WorkflowNodeExecutionStatus | undefined {
  return useWorkflowEditorStore((state) => state.executionStates[id]?.status);
}

// 各种节点
export function StartWorkflowNode({ id, data }: WorkflowNodeProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<PlayCircleOutlined />}
      tone="#1677ff"
      status={status}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        工作流入口
      </Typography.Text>
      {/* React Flow 组件,Handle用于自定义连接点 */}
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}


export function UserInputWorkflowNode({ id, data }: WorkflowNodeProps) {
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
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        {inputField}
      </Typography.Text>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function RagWorkflowNode({ id, data }: WorkflowNodeProps) {
  const status = useNodeExecutionStatus(id);
  const topK = data.nodeType === "rag" ? data.topK : 5;
  return (
    <NodeShell
      label={data.label}
      icon={<FileSearchOutlined />}
      tone="#d97706"
      status={status}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        Top K: {topK}
      </Typography.Text>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

export function ConditionWorkflowNode({ id, data }: WorkflowNodeProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<BranchesOutlined />}
      tone="#dc2626"
      status={status}
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

export function OutputWorkflowNode({ id, data }: WorkflowNodeProps) {
  const status = useNodeExecutionStatus(id);
  return (
    <NodeShell
      label={data.label}
      icon={<ExportOutlined />}
      tone="#7c3aed"
      status={status}
    >
      <Typography.Text type="secondary" className={styles.nodeMeta}>
        最终答案
      </Typography.Text>
      <Handle type="target" position={Position.Left} />
    </NodeShell>
  );
}
