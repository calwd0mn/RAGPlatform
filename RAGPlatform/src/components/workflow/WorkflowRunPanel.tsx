import { PlayCircleOutlined } from "@ant-design/icons";
import { Button, Collapse, Empty, Input, Space, Tag, Typography, message } from "antd";
import type { CollapseProps } from "antd";
import { useRef, useState } from "react";
import { runWorkflowStream } from "../../services/workflows";
import type {
  WorkflowNodeExecution,
  WorkflowRunFinal,
  WorkflowRunInputs,
  WorkflowStreamEvent,
} from "../../types/workflow";
import { PageSectionCard } from "../common/PageSectionCard";
import styles from "./WorkflowEditorPanels.module.css";

interface WorkflowRunPanelProps {
  workflowId: string;
  executions: Record<string, WorkflowNodeExecution>;
  finalResult: WorkflowRunFinal | null;
  onRunEvent: (event: WorkflowStreamEvent) => void;
  onClear: () => void;
}

function parseRunInputs(inputText: string): WorkflowRunInputs {
  const parsed = JSON.parse(inputText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("输入参数必须是 JSON 对象。");
  }
  return parsed as WorkflowRunInputs;
}

function formatOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  return JSON.stringify(output, null, 2);
}

function getExecutionSummary(item: WorkflowNodeExecution): string {
  const output = item.output;
  if (!output || typeof output !== "object") {
    return item.error ?? "等待输出";
  }
  if ("field" in output && "value" in output) {
    return `${String(output.field)} = ${String(output.value).slice(0, 48)}`;
  }
  if ("retrievedCount" in output && "retrievalProvider" in output) {
    return `命中 ${String(output.retrievedCount)} 条 · ${String(output.retrievalProvider)}`;
  }
  if ("result" in output) {
    return String(output.result);
  }
  if ("finalOutput" in output) {
    return "已生成最终答案";
  }
  if ("started" in output) {
    return "已开始";
  }
  return "已完成";
}

function getStatusTag(status: WorkflowNodeExecution["status"]) {
  if (status === "success") {
    return <Tag color="success">成功</Tag>;
  }
  if (status === "running") {
    return <Tag color="processing">运行中</Tag>;
  }
  if (status === "failed") {
    return <Tag color="error">失败</Tag>;
  }
  return <Tag>跳过</Tag>;
}

export function WorkflowRunPanel({
  workflowId,
  executions,
  finalResult,
  onRunEvent,
  onClear,
}: WorkflowRunPanelProps) {
  const [inputsText, setInputsText] = useState(
    '{\n  "question": "请介绍一下当前知识库的核心内容"\n}',
  );
  const [running, setRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRun = async (): Promise<void> => {
    let inputs: WorkflowRunInputs;
    try {
      inputs = parseRunInputs(inputsText);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "输入 JSON 无效。");
      return;
    }

    onClear();
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    setRunning(true);
    try {
      await runWorkflowStream(workflowId, inputs, {
        signal: abortController.signal,
        onEvent: onRunEvent,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      message.error(error instanceof Error ? error.message : "工作流运行失败。");
    } finally {
      setRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = (): void => {
    abortControllerRef.current?.abort();
    setRunning(false);
  };

  const executionItems = Object.values(executions);
  const successCount = executionItems.filter(
    (item) => item.status === "success",
  ).length;
  const failedCount = executionItems.filter(
    (item) => item.status === "failed",
  ).length;
  const skippedCount = executionItems.filter(
    (item) => item.status === "skipped",
  ).length;
  const collapseItems: CollapseProps["items"] = executionItems.map((item) => ({
    key: item.nodeId,
    label: (
      <div className={styles.executionLabel}>
        <span className={styles.executionName}>{item.nodeId}</span>
        <span className={styles.executionSummary}>{getExecutionSummary(item)}</span>
      </div>
    ),
    extra: getStatusTag(item.status),
    children: (
      <div className={styles.executionDetail}>
        {item.output ? (
          <pre className={styles.outputBlock}>{formatOutput(item.output)}</pre>
        ) : null}
        {item.error ? (
          <Typography.Text type="danger">{item.error}</Typography.Text>
        ) : null}
      </div>
    ),
  }));

  return (
    <PageSectionCard title="调试运行" className={styles.sideCard}>
      <Space direction="vertical" size={12} className={styles.fullWidth}>
        <div className={styles.runSection}>
          <Typography.Text strong>输入参数</Typography.Text>
        </div>
        <Input.TextArea
          rows={5}
          value={inputsText}
          disabled={running}
          onChange={(event) => setInputsText(event.target.value)}
        />
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => void handleRun()}
            loading={running}
          >
            运行
          </Button>
          <Button onClick={handleStop} disabled={!running}>
            停止
          </Button>
          <Button onClick={onClear} disabled={running}>
            清除
          </Button>
        </Space>
        <div className={styles.runOverview}>
          <span>{running ? "运行中" : finalResult ? "运行完成" : "待运行"}</span>
          <span>{successCount} 成功</span>
          <span>{skippedCount} 跳过</span>
          <span>{failedCount} 失败</span>
        </div>
        {finalResult ? (
          <div className={styles.finalOutput}>
            <Typography.Text strong>最终答案</Typography.Text>
            <Typography.Paragraph className={styles.finalOutputText}>
              {finalResult.output || "无输出"}
            </Typography.Paragraph>
          </div>
        ) : null}
        <div className={styles.executionList}>
          {executionItems.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行结果" />
          ) : (
            <Collapse
              size="small"
              ghost
              items={collapseItems}
              className={styles.executionCollapse}
            />
          )}
        </div>
      </Space>
    </PageSectionCard>
  );
}

