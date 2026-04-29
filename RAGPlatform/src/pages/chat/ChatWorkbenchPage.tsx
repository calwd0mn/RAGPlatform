import { AxiosError } from "axios";
import { useCallback, useEffect, useMemo } from "react";
import { Alert, Col, Row, Tabs, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { ChatInputBox } from "../../components/chat/ChatInputBox";
import { ChatMessageList } from "../../components/chat/ChatMessageList";
import { EvidencePanel } from "../../components/citation/EvidencePanel";
import { TracePanel } from "../../components/citation/TracePanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { RenameConversationModal } from "../../components/conversation/RenameConversationModal";
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

  const conversationListQuery = useConversationList();
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
    conversations: conversationListQuery.data ?? [],
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

    if (conversationId) {
      const matchedConversation = conversationListQuery.data?.find(
        (item) => item.id === conversationId,
      );
      if (matchedConversation) {
        return;
      }
    }

    const firstConversation = conversationListQuery.data?.[0];
    if (firstConversation) {
      navigate(`/app/chat/${firstConversation.id}`, { replace: true });
      return;
    }
    if (conversationId) {
      navigate("/app/chat", { replace: true });
    }
  }, [
    conversationId,
    conversationListQuery.data,
    conversationListQuery.isLoading,
    currentKnowledgeBaseId,
    navigate,
  ]);

  const persistedMessages = messageListQuery.data ?? [];
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
    activePanelTab,
    currentConversationSelectedCitation,
    focusEvidencePanelForMessage,
    handleAssistantPanelNavigate,
    handleCitationSelect,
    handleEvidenceCitationSelect,
    handlePanelTabChange,
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

  const evidenceTabItems = useMemo(
    () => [
      {
        key: "evidence",
        label: "Evidence",
        children: (
          <EvidencePanel
            conversationId={activeConversationId}
            message={activeAssistantMessage}
            selectedCitation={currentConversationSelectedCitation}
            onCitationSelect={handleEvidenceCitationSelect}
          />
        ),
      },
      {
        key: "trace",
        label: "Trace",
        children: <TracePanel message={activeAssistantMessage} />,
      },
    ],
    [
      activeAssistantMessage,
      activeConversationId,
      currentConversationSelectedCitation,
      handleEvidenceCitationSelect,
    ],
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
                      : "暂无会话，请先新建会话"
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
            <Tabs
              activeKey={activePanelTab}
              onChange={handlePanelTabChange}
              items={evidenceTabItems}
            />
          </PageSectionCard>
        </Col>
      </Row>

      <RenameConversationModal
        open={Boolean(renameTargetConversation)}
        conversation={renameTargetConversation}
        confirmLoading={updateConversationMutation.isPending}
        onCancel={handleCloseRenameConversation}
        onSubmit={handleRenameConversation}
      />
    </div>
  );
}
