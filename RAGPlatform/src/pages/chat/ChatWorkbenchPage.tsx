import { AxiosError } from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Col, Row, Tabs, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { ChatInputBox } from "../../components/chat/ChatInputBox";
import { ChatMessageList } from "../../components/chat/ChatMessageList";
import { EvidencePanel } from "../../components/citation/EvidencePanel";
import { TracePanel } from "../../components/citation/TracePanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { RenameConversationModal } from "../../components/conversation/RenameConversationModal";
import { ConversationSidebar } from "../../components/conversation/ConversationSidebar";
import { KnowledgeBaseStatusBar } from "../../components/document/KnowledgeBaseStatusBar";
import { queryKeys } from "../../constants/queryKeys";
import { useConversationList } from "../../hooks/chat/useConversationList";
import { useCreateConversation } from "../../hooks/chat/useCreateConversation";
import { useDeleteConversation } from "../../hooks/chat/useDeleteConversation";
import { useMessageList } from "../../hooks/chat/useMessageList";
import { useUpdateConversation } from "../../hooks/chat/useUpdateConversation";
import { askRagStream } from "../../services/rag";
import { useCitationWorkspaceStore } from "../../stores/citation-workspace.store";
import type { ApiErrorPayload } from "../../types/api";
import type { ChatMessage, ConversationItem } from "../../types/chat";
import type { RagCitation } from "../../types/rag";
import styles from "./ChatWorkbenchPage.module.css";

type EvidenceTabKey = "evidence" | "trace";

function getApiErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "请求失败，请稍后重试。";
  }
  const { message } = error.response.data;
  return Array.isArray(message) ? message.join("；") : message;
}

function getGenericErrorMessage(error: Error): string {
  const message = error.message.trim();
  if (message.length === 0) {
    return "请求失败，请稍后重试。";
  }
  return message;
}

export function ChatWorkbenchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [draft, setDraft] = useState("");
  const [activePanelTab, setActivePanelTab] =
    useState<EvidenceTabKey>("evidence");
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<
    string | null
  >(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");
  const [renameTargetConversation, setRenameTargetConversation] =
    useState<ConversationItem | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState("");
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false);
  const [streamingAssistantMessage, setStreamingAssistantMessage] =
    useState<ChatMessage | null>(null);
  const streamingAbortControllerRef = useRef<AbortController | null>(null);
  const selectedCitation = useCitationWorkspaceStore(
    (state) => state.selectedCitation,
  );
  const setSelectedCitation = useCitationWorkspaceStore(
    (state) => state.setSelectedCitation,
  );
  const clearSelectedCitation = useCitationWorkspaceStore(
    (state) => state.clearSelectedCitation,
  );

  const conversationListQuery = useConversationList();
  const createConversationMutation = useCreateConversation();
  const updateConversationMutation = useUpdateConversation();
  const deleteConversationMutation = useDeleteConversation();
  const messageListQuery = useMessageList(conversationId);

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
  const isSubmitting = isStreamingAnswer || createConversationMutation.isPending;
  const persistedMessages = messageListQuery.data ?? [];
  const messages = useMemo(() => {
    if (!streamingAssistantMessage || streamingAssistantMessage.id.length === 0) {
      return persistedMessages;
    }
    return [...persistedMessages, streamingAssistantMessage];
  }, [persistedMessages, streamingAssistantMessage]);
  const assistantMessages = useMemo(
    () =>
      messages.filter((item): item is ChatMessage => item.role === "assistant"),
    [messages],
  );
  const currentConversationSelectedCitation = useMemo(() => {
    if (
      !selectedCitation ||
      selectedCitation.conversationId !== activeConversationId
    ) {
      return null;
    }
    return selectedCitation;
  }, [activeConversationId, selectedCitation]);

  const activeAssistantMessage = useMemo(() => {
    if (!assistantMessages.length) {
      return undefined;
    }
    if (currentConversationSelectedCitation) {
      const matchedByCitation = assistantMessages.find(
        (item) =>
          item.id === currentConversationSelectedCitation.assistantMessageId,
      );
      if (matchedByCitation) {
        return matchedByCitation;
      }
    }
    if (activeAssistantMessageId) {
      const matchedMessage = assistantMessages.find(
        (item) => item.id === activeAssistantMessageId,
      );
      if (matchedMessage) {
        return matchedMessage;
      }
    }
    return assistantMessages[assistantMessages.length - 1];
  }, [
    activeAssistantMessageId,
    assistantMessages,
    currentConversationSelectedCitation,
  ]);

  useEffect(() => {
    setActiveAssistantMessageId(null);
    setActivePanelTab("evidence");
    clearSelectedCitation();
    streamingAbortControllerRef.current?.abort();
    streamingAbortControllerRef.current = null;
    setIsStreamingAnswer(false);
    setStreamingAssistantMessage(null);
  }, [activeConversationId, clearSelectedCitation]);

  useEffect(
    () => () => {
      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!assistantMessages.length) {
      setActiveAssistantMessageId(null);
      return;
    }

    if (
      activeAssistantMessageId &&
      assistantMessages.some((item) => item.id === activeAssistantMessageId)
    ) {
      return;
    }

    setActiveAssistantMessageId(
      assistantMessages[assistantMessages.length - 1].id,
    );
  }, [activeAssistantMessageId, assistantMessages]);

  useEffect(() => {
    if (!currentConversationSelectedCitation) {
      return;
    }

    const matchedMessage = assistantMessages.find(
      (item) =>
        item.id === currentConversationSelectedCitation.assistantMessageId,
    );

    if (!matchedMessage) {
      clearSelectedCitation();
      return;
    }

    const citations = matchedMessage.citations ?? [];
    if (
      currentConversationSelectedCitation.citationIndex < 0 ||
      currentConversationSelectedCitation.citationIndex >= citations.length
    ) {
      clearSelectedCitation();
    }
  }, [
    assistantMessages,
    clearSelectedCitation,
    currentConversationSelectedCitation,
  ]);

  const handleSubmit = async () => {
    const query = draft.trim();
    if (!query || isSubmitting) {
      return;
    }

    setSubmitErrorMessage("");
    let targetConversationId = activeConversationId;
    let shouldRefreshAfterStreamFailure = false;

    try {
      if (!targetConversationId) {
        const createdConversation =
          await createConversationMutation.mutateAsync({});
        targetConversationId = createdConversation.id;
        navigate(`/app/chat/${createdConversation.id}`);
      }

      const tempAssistantMessageId = `stream-${Date.now()}`;
      const createdAtLabel = new Date().toLocaleString("zh-CN", {
        hour12: false,
      });
      const streamController = new AbortController();
      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = streamController;
      setIsStreamingAnswer(true);
      setStreamingAssistantMessage({
        id: tempAssistantMessageId,
        role: "assistant",
        content: "正在生成...",
        createdAt: createdAtLabel,
        citations: [],
        trace: undefined,
      });
      setActiveAssistantMessageId(tempAssistantMessageId);
      setActivePanelTab("evidence");
      clearSelectedCitation();
      setDraft("");
      shouldRefreshAfterStreamFailure = true;

      const result = await askRagStream(
        {
          conversationId: targetConversationId,
          query,
        },
        {
          signal: streamController.signal,
          onToken: (token) => {
            setStreamingAssistantMessage((previous) => {
              if (!previous || previous.id !== tempAssistantMessageId) {
                return previous;
              }
              return {
                ...previous,
                content:
                  previous.content === "正在生成..."
                    ? token
                    : `${previous.content}${token}`,
              };
            });
          },
        },
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.list(result.conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.list,
        }),
      ]);

      setActiveAssistantMessageId(result.assistantMessageId);
      setActivePanelTab("evidence");
      clearSelectedCitation();
      setStreamingAssistantMessage(null);
      shouldRefreshAfterStreamFailure = false;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStreamingAssistantMessage(null);
      } else if (error instanceof AxiosError) {
        setSubmitErrorMessage(getApiErrorMessage(error));
        setStreamingAssistantMessage(null);
      } else if (error instanceof Error) {
        setSubmitErrorMessage(getGenericErrorMessage(error));
        setStreamingAssistantMessage(null);
      } else {
        setSubmitErrorMessage("请求失败，请稍后重试。");
        setStreamingAssistantMessage(null);
      }
    } finally {
      if (shouldRefreshAfterStreamFailure && targetConversationId) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages.list(targetConversationId),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.list,
          }),
        ]);
      }
      setIsStreamingAnswer(false);
      streamingAbortControllerRef.current = null;
    }
  };

  const handleAbortStreaming = () => {
    const activeController = streamingAbortControllerRef.current;
    if (!activeController) {
      return;
    }
    activeController.abort();
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

  const handleOpenRenameConversation = (conversation: ConversationItem) => {
    setRenameTargetConversation(conversation);
  };

  const handleCloseRenameConversation = () => {
    setRenameTargetConversation(null);
  };

  const handleRenameConversation = async (title: string) => {
    if (!renameTargetConversation) {
      return;
    }
    await updateConversationMutation.mutateAsync({
      conversationId: renameTargetConversation.id,
      title,
    });
    setRenameTargetConversation(null);
  };

  const handleDeleteConversation = async (conversation: ConversationItem) => {
    const currentList = conversationListQuery.data ?? [];
    const remainingConversations = currentList.filter(
      (item) => item.id !== conversation.id,
    );

    setDeletingConversationId(conversation.id);
    try {
      await deleteConversationMutation.mutateAsync({
        conversationId: conversation.id,
      });

      if (conversation.id !== activeConversationId) {
        return;
      }

      const nextConversation = remainingConversations[0];
      if (nextConversation) {
        navigate(`/app/chat/${nextConversation.id}`, { replace: true });
        return;
      }

      navigate("/app/chat", { replace: true });
    } catch (error) {
      const requestError = error as AxiosError<ApiErrorPayload>;
      message.error(getApiErrorMessage(requestError));
    } finally {
      setDeletingConversationId("");
    }
  };

  const handlePanelTabChange = (nextTab: string) => {
    if (nextTab === "evidence" || nextTab === "trace") {
      setActivePanelTab(nextTab);
    }
  };

  const handleAssistantPanelNavigate = (
    messageId: string,
    tab: EvidenceTabKey,
  ) => {
    setActiveAssistantMessageId(messageId);
    setActivePanelTab(tab);
    if (selectedCitation?.assistantMessageId !== messageId) {
      clearSelectedCitation();
    }
  };

  const handleCitationSelect = (
    message: ChatMessage,
    citation: RagCitation,
    citationIndex: number,
  ) => {
    if (!activeConversationId) {
      return;
    }
    setSelectedCitation({
      conversationId: activeConversationId,
      assistantMessageId: message.id,
      citationIndex,
      documentId: citation.documentId,
      documentName: citation.documentName,
      chunkId: citation.chunkId,
      page: citation.page,
      content: citation.content,
      score: citation.score,
    });
    setActiveAssistantMessageId(message.id);
    setActivePanelTab("evidence");
  };

  const handleEvidenceCitationSelect = (
    message: ChatMessage,
    citationIndex: number,
  ) => {
    const citations = message.citations ?? [];
    const targetCitation = citations[citationIndex];
    if (!targetCitation) {
      return;
    }
    handleCitationSelect(message, targetCitation, citationIndex);
  };

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
                  value={draft}
                  onChange={setDraft}
                  onSubmit={handleSubmit}
                  onAbort={handleAbortStreaming}
                  submitting={isSubmitting}
                  streaming={isStreamingAnswer}
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
              items={[
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
              ]}
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
