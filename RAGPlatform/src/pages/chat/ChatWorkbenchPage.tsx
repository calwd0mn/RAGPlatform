import type { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { Col, Row, Space, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { ChatInputBox } from "../../components/chat/ChatInputBox";
import { ChatMessageList } from "../../components/chat/ChatMessageList";
import { CitationPanel } from "../../components/citation/CitationPanel";
import { TracePanel } from "../../components/citation/TracePanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { ConversationSidebar } from "../../components/conversation/ConversationSidebar";
import { useConversationList } from "../../hooks/chat/useConversationList";
import { useCreateConversation } from "../../hooks/chat/useCreateConversation";
import { useMessageList } from "../../hooks/chat/useMessageList";
import { useSendMessage } from "../../hooks/chat/useSendMessage";
import type { ApiErrorPayload } from "../../types/api";
import type { CitationItem, TraceItem } from "../../types/chat";
import styles from "./ChatWorkbenchPage.module.css";

const emptyCitations: CitationItem[] = [];
const emptyTraces: TraceItem[] = [];

function getApiErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "请求失败，请稍后重试。";
  }
  const { message } = error.response.data;
  return Array.isArray(message) ? message.join("；") : message;
}

export function ChatWorkbenchPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [draft, setDraft] = useState("");

  const conversationListQuery = useConversationList();
  const createConversationMutation = useCreateConversation();
  const messageListQuery = useMessageList(conversationId);
  const sendMessageMutation = useSendMessage();

  useEffect(() => {
    if (conversationId) {
      return;
    }

    const firstConversation = conversationListQuery.data?.[0];
    if (firstConversation) {
      navigate(`/app/chat/${firstConversation.id}`, { replace: true });
    }
  }, [conversationId, conversationListQuery.data, navigate]);

  const activeConversationId = conversationId ?? "";

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content || !activeConversationId || sendMessageMutation.isPending) {
      return;
    }

    sendMessageMutation.mutate(
      { conversationId: activeConversationId, content },
      {
        onSuccess: () => {
          setDraft("");
        },
      },
    );
  };

  const handleSelectConversation = (nextConversationId: string) => {
    navigate(`/app/chat/${nextConversationId}`);
  };

  const handleCreateConversation = () => {
    createConversationMutation.mutate(
      {},
      {
        onSuccess: (createdConversation) => {
          navigate(`/app/chat/${createdConversation.id}`);
        },
      },
    );
  };

  return (
    <Space direction="vertical" size={16} className={styles.pageStack}>
      <Typography.Title level={4} className={styles.pageTitle}>
        对话工作台
      </Typography.Title>

      <Row gutter={[16, 16]} className={styles.layoutRow}>
        <Col xs={24} lg={6} className={styles.stretchCol}>
          <PageSectionCard title="会话列表">
            <ConversationSidebar
              conversations={conversationListQuery.data ?? []}
              activeId={activeConversationId}
              isLoading={conversationListQuery.isLoading}
              isError={conversationListQuery.isError}
              errorMessage={getApiErrorMessage(conversationListQuery.error)}
              isCreating={createConversationMutation.isPending}
              onSelect={handleSelectConversation}
              onCreate={handleCreateConversation}
            />
          </PageSectionCard>
        </Col>

        <Col xs={24} lg={12} className={styles.stretchCol}>
          <PageSectionCard title="聊天消息">
            <div className={styles.chatPanel}>
              <div className={styles.messagesViewport}>
                <ChatMessageList
                  items={messageListQuery.data ?? []}
                  loading={Boolean(activeConversationId) && messageListQuery.isLoading}
                  errorMessage={
                    activeConversationId && messageListQuery.isError
                      ? getApiErrorMessage(messageListQuery.error)
                      : undefined
                  }
                  emptyDescription={
                    activeConversationId ? "暂无消息，开始你的第一轮问答" : "暂无会话，请先新建会话"
                  }
                />
              </div>
              <div className={styles.inputDock}>
                <ChatInputBox
                  value={draft}
                  onChange={setDraft}
                  onSubmit={handleSubmit}
                  submitting={sendMessageMutation.isPending}
                  disabled={!activeConversationId}
                />
              </div>
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24} lg={6} className={styles.stretchCol}>
          <Space direction="vertical" size={16} className={styles.sideStack}>
            <PageSectionCard title="证据引用">
              <CitationPanel items={emptyCitations} />
            </PageSectionCard>
            <PageSectionCard title="Trace 面板">
              <TracePanel items={emptyTraces} />
            </PageSectionCard>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
