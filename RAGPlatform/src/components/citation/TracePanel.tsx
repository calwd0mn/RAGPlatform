import { Alert, Descriptions, Empty, Space, Tag } from "antd";
import type { ChatMessage } from "../../types/chat";
import styles from "./TracePanel.module.css";

interface TracePanelProps {
  message?: ChatMessage;
}

export function TracePanel({ message }: TracePanelProps) {
  if (!message) {
    return (
      <Empty
        description="当前会话还没有 assistant 回答"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const trace = message.trace;
  if (!trace) {
    return (
      <Space direction="vertical" size={12} className={styles.panelStack}>
        <Alert type="info" showIcon title="当前回答未返回 trace 元数据。" />
        <Empty
          description="该回答没有 trace 数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={12} className={styles.panelStack}>
      {trace.retrievedCount === 0 ? (
        <Alert
          type="warning"
          showIcon
          title="retrievedCount = 0，本轮没有召回到文档。"
        />
      ) : null}

      <Space size={8} wrap>
        <Tag color="blue">Trace 已加载</Tag>
        <Tag>TopK {trace.topK ?? "-"}</Tag>
        <Tag>Retrieved {trace.retrievedCount ?? "-"}</Tag>
        <Tag>Context {trace.contextChunkCount ?? "-"}</Tag>
        {trace.contextTrimmed ? <Tag color="orange">Trimmed</Tag> : null}
      </Space>

      <Descriptions size="small" column={1} className={styles.summary}>
        <Descriptions.Item label="Query">
          {trace.query ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Rewritten">
          {trace.rewrittenQuery ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Top K">{trace.topK ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Retrieved">
          {trace.retrievedCount ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Context Chunks">
          {trace.contextChunkCount ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Context Chars">
          {trace.contextCharCount ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Context Trimmed">
          {typeof trace.contextTrimmed === "boolean"
            ? trace.contextTrimmed
              ? "yes"
              : "no"
            : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Model">
          {trace.model ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Provider">
          {trace.retrievalProvider ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Latency">
          {typeof trace.latencyMs === "number" ? `${trace.latencyMs} ms` : "-"}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
}
