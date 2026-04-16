import { Alert, Avatar, Empty, Space, Spin, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types/chat";
import styles from "./ChatMessageList.module.css";

interface ChatMessageListProps {
  items: ChatMessage[];
  loading?: boolean;
  errorMessage?: string;
  emptyDescription?: string;
}

export function ChatMessageList({
  items,
  loading = false,
  errorMessage,
  emptyDescription = "暂无消息，开始你的第一轮问答",
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<string[]>([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  const toggleExpanded = (messageId: string) => {
    setExpandedMessageIds((currentIds) =>
      currentIds.includes(messageId)
        ? currentIds.filter((id) => id !== messageId)
        : [...currentIds, messageId],
    );
  };

  const canExpand = (content: string): boolean => {
    return content.length > 180 || content.split("\n").length > 6;
  };

  if (loading) {
    return (
      <div className={styles.emptyWrap}>
        <Spin size="large" tip="消息加载中..." />
      </div>
    );
  }

  if (errorMessage) {
    return <Alert type="error" showIcon message={errorMessage} />;
  }

  if (!items.length) {
    return (
      <div className={styles.emptyWrap}>
        <Empty description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={styles.listWrap}>
      {items.map((item) => {
        const isUser = item.role === "user";
        const expanded = expandedMessageIds.includes(item.id);
        const expandable = canExpand(item.content);
        return (
          <div
            key={item.id}
            className={`${styles.row} ${isUser ? styles.rowUser : styles.rowAssistant}`}
          >
            {!isUser ? <Avatar className={styles.avatar}>AI</Avatar> : null}

            <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
              <Space size={8} className={styles.meta}>
                <Typography.Text strong>{isUser ? "你" : "模型"}</Typography.Text>
                <Typography.Text type="secondary" className={styles.timeText}>
                  {item.createdAt}
                </Typography.Text>
              </Space>
              <div
                className={`${styles.contentWrap} ${
                  expanded ? styles.contentExpanded : styles.contentCollapsed
                }`}
              >
                <Typography.Paragraph className={styles.paragraph}>
                  {item.content}
                </Typography.Paragraph>
              </div>
              {expandable ? (
                <Typography.Link
                  className={styles.expandToggle}
                  onClick={() => toggleExpanded(item.id)}
                >
                  {expanded ? "收起" : "展开"}
                </Typography.Link>
              ) : null}
            </div>

            {isUser ? <Avatar className={styles.avatar}>U</Avatar> : null}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
