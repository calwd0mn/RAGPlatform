import { Flex, List, Space, Typography } from "antd";
import type { ConversationItem } from "../../types/chat";
import { ConversationActionsDropdown } from "./ConversationActionsDropdown";
import styles from "./ConversationListItem.module.css";

interface ConversationListItemProps {
  item: ConversationItem;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: (conversationId: string) => void;
  onRename: (conversation: ConversationItem) => void;
  onDelete: (conversation: ConversationItem) => void;
}

export function ConversationListItem({
  item,
  isActive,
  isDeleting,
  onSelect,
  onRename,
  onDelete,
}: ConversationListItemProps) {
  return (
    <List.Item
      className={`${styles.item} ${isActive ? styles.active : ""}`}
      onClick={() => onSelect(item.id)}
    >
      <Flex align="center" justify="space-between" gap={8} className={styles.itemRow}>
        <Space direction="vertical" size={4} className={styles.content}>
          <Typography.Text strong ellipsis={{ tooltip: item.title }}>
            {item.title}
          </Typography.Text>
          <Typography.Text type="secondary" className={styles.metaText}>
            更新于 {item.updatedAt}
          </Typography.Text>
        </Space>
        <ConversationActionsDropdown
          disabled={isDeleting}
          onRename={() => onRename(item)}
          onDelete={() => onDelete(item)}
        />
      </Flex>
    </List.Item>
  );
}
