import { Alert, Avatar, Empty, Space, Spin, Typography } from "antd";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

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
              <Typography.Paragraph className={styles.paragraph}>
                {item.content}
              </Typography.Paragraph>
            </div>

            {isUser ? <Avatar className={styles.avatar}>U</Avatar> : null}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
