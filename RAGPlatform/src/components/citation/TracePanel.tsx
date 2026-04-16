import { List, Space, Tag, Typography } from "antd";
import type { TraceItem } from "../../types/chat";
import styles from "./TracePanel.module.css";

interface TracePanelProps {
  items: TraceItem[];
}

export function TracePanel({ items }: TracePanelProps) {
  return (
    <List
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <Space direction="vertical" size={4}>
            <Space size={8}>
              <Typography.Text strong className={styles.stepText}>
                {item.step}
              </Typography.Text>
              <Tag>{item.elapsedMs}ms</Tag>
            </Space>
            <Typography.Text type="secondary">{item.detail}</Typography.Text>
          </Space>
        </List.Item>
      )}
    />
  );
}
