import { lazy, memo, Suspense, useMemo, useState } from "react";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Flex, Input, Spin } from "antd";
import type { ConversationItem } from "../../types/chat";
import styles from "./ConversationSidebar.module.css";

const ConversationList = lazy(() =>
  import("./ConversationList").then((module) => ({
    default: module.ConversationList,
  })),
);

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  activeId: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isCreating: boolean;
  deletingConversationId: string;
  onSelect: (conversationId: string) => void;
  onCreate: () => void;
  onRename: (conversation: ConversationItem) => void;
  onDelete: (conversation: ConversationItem) => void;
}

export const ConversationSidebar = memo(function ConversationSidebar({
  conversations,
  activeId,
  isLoading,
  isError,
  errorMessage,
  isCreating,
  deletingConversationId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ConversationSidebarProps) {
  const [searchValue, setSearchValue] = useState("");
  const filteredConversations = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }
    return conversations.filter((item) =>
      item.title.toLowerCase().includes(keyword),
    );
  }, [conversations, searchValue]);

  const hasConversation = conversations.length > 0;
  const isSearchEmpty = hasConversation && filteredConversations.length === 0;

  return (
    <Flex vertical gap={12} className={styles.root}>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onCreate}
        loading={isCreating}
      >
        新建会话
      </Button>

      <Input
        allowClear
        placeholder="搜索会话标题"
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={(event) => {
          setSearchValue(event.target.value);
        }}
      />

      {isLoading ? <Spin tip="会话加载中..." /> : null}

      {isError ? <Alert type="error" showIcon title={errorMessage} /> : null}

      {!isLoading && !isError && !hasConversation ? (
        <div className={styles.listScroll}>
          <Empty
            description="暂无会话，点击上方按钮新建"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : null}

      {!isLoading && !isError && isSearchEmpty ? (
        <div className={styles.listScroll}>
          <Empty
            description={`未找到与“${searchValue.trim()}”匹配的会话`}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : null}

      {!isLoading && !isError && filteredConversations.length > 0 ? (
        <div className={styles.listScroll}>
          <Suspense fallback={<Spin tip="会话加载中..." />}>
            <ConversationList
              items={filteredConversations}
              activeId={activeId}
              deletingConversationId={deletingConversationId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          </Suspense>
        </div>
      ) : null}
    </Flex>
  );
});
