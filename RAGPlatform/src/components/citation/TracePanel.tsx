import { Alert, Descriptions, Empty, Space } from "antd";
import type { ChatMessage } from "../../types/chat";
import styles from "./TracePanel.module.css";

interface TracePanelProps {
  message?: ChatMessage;
}

export function TracePanel({ message }: TracePanelProps) {
  if (!message) {
    return <Empty description="当前会话还没有 assistant 回答" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const trace = message.trace;
  if (!trace) {
    return <Empty description="该回答没有 trace 数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Space direction="vertical" size={12} className={styles.panelStack}>
      {trace.retrievedCount === 0 ? (
        <Alert type="warning" showIcon title="retrievedCount = 0，本轮没有召回到文档。" />
      ) : null}

      <Descriptions size="small" column={1} className={styles.summary}>
        <Descriptions.Item label="Query">{trace.query ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Rewritten">{trace.rewrittenQuery ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Top K">{trace.topK ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Retrieved">{trace.retrievedCount ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Model">{trace.model ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Provider">{trace.retrievalProvider ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Latency">
          {typeof trace.latencyMs === "number" ? `${trace.latencyMs} ms` : "-"}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
}
