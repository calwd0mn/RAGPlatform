import { List } from "antd";
import type { ConversationItem } from "../../types/chat";
import { ConversationListItem } from "./ConversationListItem";

interface ConversationListProps {
  items: ConversationItem[];
  activeId: string;
  deletingConversationId: string;
  onSelect: (conversationId: string) => void;
  onRename: (conversation: ConversationItem) => void;
  onDelete: (conversation: ConversationItem) => void;
}

export function ConversationList({
  items,
  activeId,
  deletingConversationId,
  onSelect,
  onRename,
  onDelete,
}: ConversationListProps) {
  return (
    <List
      dataSource={items}
      split
      renderItem={(item) => {
        const isActive = item.id === activeId;
        return (
          <ConversationListItem
            item={item}
            isActive={isActive}
            isDeleting={item.id === deletingConversationId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        );
      }}
    />
  );
}
