import { Alert, Button, Empty, Flex, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { ConversationItem } from "../../types/chat";
import { ConversationList } from "./ConversationList";

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  activeId: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isCreating: boolean;
  onSelect: (conversationId: string) => void;
  onCreate: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  isLoading,
  isError,
  errorMessage,
  isCreating,
  onSelect,
  onCreate,
}: ConversationSidebarProps) {
  return (
    <Flex vertical gap={12}>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onCreate}
        loading={isCreating}
      >
        新建会话
      </Button>

      {isLoading ? <Spin tip="会话加载中..." /> : null}

      {isError ? <Alert type="error" showIcon message={errorMessage} /> : null}

      {!isLoading && !isError && conversations.length === 0 ? (
        <Empty description="暂无会话，点击上方按钮新建" />
      ) : null}

      {!isLoading && !isError && conversations.length > 0 ? (
        <ConversationList items={conversations} activeId={activeId} onSelect={onSelect} />
      ) : null}
    </Flex>
  );
}
