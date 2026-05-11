import { AxiosError } from "axios";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Col, Row, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { ChatInputBox } from "../../components/chat/ChatInputBox";
import { ChatMessageList } from "../../components/chat/ChatMessageList";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { ConversationSidebar } from "../../components/conversation/ConversationSidebar";
import { KnowledgeBaseStatusBar } from "../../components/document/KnowledgeBaseStatusBar";
import { useActiveAssistantWorkspace } from "../../hooks/chat/useActiveAssistantWorkspace";
import { useChatStreaming } from "../../hooks/chat/useChatStreaming";
import { useConversationActions } from "../../hooks/chat/useConversationActions";
import { useConversationList } from "../../hooks/chat/useConversationList";
import { useMessageList } from "../../hooks/chat/useMessageList";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { ChatMessage } from "../../types/chat";
import styles from "./ChatWorkbenchPage.module.css";

const AssistantWorkspaceTabs = lazy(() =>
  import("../../components/citation/AssistantWorkspaceTabs").then((module) => ({
    default: module.AssistantWorkspaceTabs,
  })),
);
const RenameConversationModal = lazy(() =>
  import("../../components/conversation/RenameConversationModal").then(
    (module) => ({
      default: module.RenameConversationModal,
    }),
  ),
);

function getApiErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "请求失败，请稍后重试。";
  }
  const { message } = error.response.data;
  return Array.isArray(message) ? message.join("；") : message;
}

function mergeStreamingMessage(
  persistedMessages: ChatMessage[],
  streamingAssistantMessage: ChatMessage | null,
): ChatMessage[] {
  if (!streamingAssistantMessage) {
    return persistedMessages;
  }

  const isPersisted = persistedMessages.some(
    (message) =>
      message.requestId &&
      message.requestId === streamingAssistantMessage.requestId &&
      message.role === "assistant",
  );
  if (isPersisted) {
    return persistedMessages;
  }

  return [...persistedMessages, streamingAssistantMessage];
}

export function ChatWorkbenchPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  const [shouldLoadConversationList, setShouldLoadConversationList] = useState(
    Boolean(conversationId),
  );
  useEffect(() => {
    if (conversationId) {
      setShouldLoadConversationList(true);
      return;
    }

    setShouldLoadConversationList(false);
    if (currentKnowledgeBaseId.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldLoadConversationList(true);
    }, 2_000);

    return () => window.clearTimeout(timeoutId);
  }, [conversationId, currentKnowledgeBaseId]);

  const conversationListQuery = useConversationList({
    enabled: shouldLoadConversationList,
  });
  const activeConversationId = conversationId ?? "";
  const activeConversation = useMemo(
    () =>
      (conversationListQuery.data ?? []).find(
        (item) => item.id === activeConversationId,
      ),
    [activeConversationId, conversationListQuery.data],
  );
  const messageListQuery = useMessageList(activeConversation?.id);
  const {
    createConversationMutation,
    deletingConversationId,
    handleCloseRenameConversation,
    handleCreateConversation,
    handleDeleteConversation,
    handleOpenRenameConversation,
    handleRenameConversation,
    renameTargetConversation,
    updateConversationMutation,
  } = useConversationActions({
    activeConversationId,
    navigate,
  });

  useEffect(() => {
    if (currentKnowledgeBaseId.length === 0) {
      navigate("/app/chat", { replace: true });
      return;
    }

    if (conversationListQuery.isLoading) {
      return;
    }

    if (!conversationId) {
      return;
    }

    const matchedConversation = conversationListQuery.data?.find(
      (item) => item.id === conversationId,
    );
    if (matchedConversation) {
      return;
    }

    navigate("/app/chat", { replace: true });
  }, [
    conversationId,
    conversationListQuery.data,
    conversationListQuery.isLoading,
    currentKnowledgeBaseId,
    navigate,
  ]);

  const persistedMessages = useMemo(
    () => messageListQuery.data ?? [],
    [messageListQuery.data],
  );
  const {
    isStreamingAnswer,
    isSubmitting,
    streamingAssistantMessage,
    submitErrorMessage,
    handleAbortStreaming,
    handleSubmit,
  } = useChatStreaming({
    activeConversation,
    activeConversationId,
    createConversation: createConversationMutation,
    currentKnowledgeBaseId,
    navigate,
  });
  const messages = useMemo(
    () => mergeStreamingMessage(persistedMessages, streamingAssistantMessage),
    [persistedMessages, streamingAssistantMessage],
  );
  const {
    activeAssistantMessage,
    currentConversationSelectedCitation,
    focusEvidencePanelForMessage,
    handleAssistantPanelNavigate,
    handleCitationSelect,
    handleEvidenceCitationSelect,
    panelTabRequest,
  } = useActiveAssistantWorkspace({
    activeConversationId,
    messages,
  });

  useEffect(() => {
    if (!streamingAssistantMessage) {
      return;
    }

    focusEvidencePanelForMessage(streamingAssistantMessage.id);
  }, [focusEvidencePanelForMessage, streamingAssistantMessage]);

  const handleSelectConversation = useCallback(
    (nextConversationId: string) => {
      navigate(`/app/chat/${nextConversationId}`);
    },
    [navigate],
  );

  const askErrorMessage = submitErrorMessage;

  return (
    <div className={styles.pageStack}>
      <Typography.Title level={4} className={styles.pageTitle}>
        对话工作台
      </Typography.Title>

      <KnowledgeBaseStatusBar />

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
              deletingConversationId={deletingConversationId}
              onSelect={handleSelectConversation}
              onCreate={handleCreateConversation}
              onRename={handleOpenRenameConversation}
              onDelete={handleDeleteConversation}
            />
          </PageSectionCard>
        </Col>

        <Col xs={24} lg={12} className={styles.stretchCol}>
          <PageSectionCard title="聊天消息">
            <div className={styles.chatPanel}>
              <div className={styles.messagesViewport}>
                <ChatMessageList
                  items={messages}
                  loading={
                    Boolean(activeConversationId) && messageListQuery.isLoading
                  }
                  errorMessage={
                    activeConversationId && messageListQuery.isError
                      ? getApiErrorMessage(messageListQuery.error)
                      : undefined
                  }
                  emptyDescription={
                    activeConversationId
                      ? "暂无消息，开始你的第一轮问答"
                      : "暂无消息，开始你的第一轮问答"
                  }
                  activeAssistantMessageId={activeAssistantMessage?.id}
                  selectedCitation={currentConversationSelectedCitation}
                  onAssistantPanelNavigate={handleAssistantPanelNavigate}
                  onCitationSelect={handleCitationSelect}
                />
              </div>
              <div className={styles.inputDock}>
                {askErrorMessage ? (
                  <Alert
                    type="error"
                    showIcon
                    title={askErrorMessage}
                    className={styles.submitError}
                  />
                ) : null}
                <ChatInputBox
                  onSubmit={handleSubmit}
                  onAbort={handleAbortStreaming}
                  submitting={isSubmitting}
                  streaming={isStreamingAnswer}
                  resetKey={activeConversationId}
                />
              </div>
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24} lg={6} className={styles.stretchCol}>
          <PageSectionCard title="证据工作区">
            {activeAssistantMessage ? (
              <Suspense
                fallback={
                  <Typography.Text type="secondary">
                    证据工作区加载中...
                  </Typography.Text>
                }
              >
                <AssistantWorkspaceTabs
                  key={activeConversationId}
                  activeConversationId={activeConversationId}
                  message={activeAssistantMessage}
                  selectedCitation={currentConversationSelectedCitation}
                  panelTabRequest={panelTabRequest}
                  onCitationSelect={handleEvidenceCitationSelect}
                />
              </Suspense>
            ) : (
              <Typography.Text type="secondary">
                暂无证据内容
              </Typography.Text>
            )}
          </PageSectionCard>
        </Col>
      </Row>

      {renameTargetConversation ? (
        <Suspense fallback={null}>
          <RenameConversationModal
            open
            conversation={renameTargetConversation}
            confirmLoading={updateConversationMutation.isPending}
            onCancel={handleCloseRenameConversation}
            onSubmit={handleRenameConversation}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
