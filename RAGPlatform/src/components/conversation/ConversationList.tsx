import { List, Space, Typography } from "antd";
import type { ConversationItem } from "../../types/chat";
import styles from "./ConversationList.module.css";

interface ConversationListProps {
  items: ConversationItem[];
  activeId: string;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({
  items,
  activeId,
  onSelect,
}: ConversationListProps) {
  return (
    <List
      dataSource={items}
      split
      renderItem={(item) => {
        const isActive = item.id === activeId;
        return (
          <List.Item
            className={`${styles.item} ${isActive ? styles.active : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <Space direction="vertical" size={4}>
              <Typography.Text strong>{item.title}</Typography.Text>
              <Typography.Text type="secondary" className={styles.metaText}>
                更新于 {item.updatedAt}
              </Typography.Text>
            </Space>
          </List.Item>
        );
      }}
    />
  );
}
