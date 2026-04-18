import { Alert, Avatar, Empty, Space, Spin, Typography } from "antd";
import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../types/chat";
import type { CitationWorkspaceSelection } from "../../types/citation";
import type { RagCitation } from "../../types/rag";
import { AssistantMessageCard } from "./AssistantMessageCard";
import styles from "./ChatMessageList.module.css";

interface ChatMessageListProps {
  items: ChatMessage[];
  loading?: boolean;
  errorMessage?: string;
  emptyDescription?: string;
  activeAssistantMessageId?: string;
  selectedCitation?: CitationWorkspaceSelection | null;
  onAssistantPanelNavigate?: (
    messageId: string,
    tab: "evidence" | "trace",
  ) => void;
  onCitationSelect?: (message: ChatMessage, citation: RagCitation, citationIndex: number) => void;
}

export function ChatMessageList({
  items,
  loading = false,
  errorMessage,
  emptyDescription = "暂无消息，开始你的第一轮问答",
  activeAssistantMessageId,
  selectedCitation,
  onAssistantPanelNavigate,
  onCitationSelect,
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
    return <Alert type="error" showIcon title={errorMessage} />;
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
        const isAssistantSelected =
          !isUser &&
          Boolean(activeAssistantMessageId) &&
          activeAssistantMessageId === item.id;

        if (!isUser) {
          return (
            <AssistantMessageCard
              key={item.id}
              message={item}
              selected={isAssistantSelected}
              selectedCitation={selectedCitation}
              onNavigatePanel={onAssistantPanelNavigate}
              onCitationSelect={onCitationSelect}
            />
          );
        }

        return (
          <div
            key={item.id}
            className={`${styles.row} ${styles.rowUser}`}
          >
            <div className={`${styles.bubble} ${styles.userBubble}`}>
              <Space size={8} className={styles.meta}>
                <Typography.Text strong>你</Typography.Text>
                <Typography.Text type="secondary" className={styles.timeText}>
                  {item.createdAt}
                </Typography.Text>
              </Space>
              <div className={styles.contentWrap}>
                <Typography.Paragraph className={styles.paragraph}>
                  {item.content}
                </Typography.Paragraph>
              </div>
            </div>

            <Avatar className={styles.avatar}>U</Avatar>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
