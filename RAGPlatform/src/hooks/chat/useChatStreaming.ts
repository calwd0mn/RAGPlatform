import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { NavigateFunction } from "react-router-dom";
import { queryKeys } from "../../constants/queryKeys";
import { askRagStream } from "../../services/rag";
import type { ApiErrorPayload } from "../../types/api";
import type { ChatMessage, ConversationItem } from "../../types/chat";

interface CreateConversationAction {
  isPending: boolean;
  mutateAsync: (payload: { title?: string }) => Promise<ConversationItem>;
}

interface UseChatStreamingOptions {
  activeConversation: ConversationItem | undefined;
  activeConversationId: string;
  createConversation: CreateConversationAction;
  currentKnowledgeBaseId: string;
  navigate: NavigateFunction;
}

interface UseChatStreamingResult {
  isStreamingAnswer: boolean;
  isSubmitting: boolean;
  streamingAssistantMessage: ChatMessage | null;
  submitErrorMessage: string;
  handleAbortStreaming: () => void;
  handleSubmit: (query: string) => Promise<void>;
}

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

export function useChatStreaming(
  options: UseChatStreamingOptions,
): UseChatStreamingResult {
  const {
    activeConversation,
    activeConversationId,
    createConversation,
    currentKnowledgeBaseId,
    navigate,
  } = options;
  const queryClient = useQueryClient();
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false);
  const [streamingAssistantMessage, setStreamingAssistantMessage] =
    useState<ChatMessage | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");
  const streamingAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    streamingAbortControllerRef.current?.abort();
    streamingAbortControllerRef.current = null;
    setIsStreamingAnswer(false);
    setStreamingAssistantMessage(null);
    setSubmitErrorMessage("");
  }, [activeConversationId]);

  useEffect(
    () => () => {
      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = null;
    },
    [],
  );

  const invalidateConversationData = async (
    conversationId: string,
  ): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(currentKnowledgeBaseId),
      }),
    ]);
  };

  const handleSubmit = async (nextQuery: string): Promise<void> => {
    const query = nextQuery.trim();
    if (!query || isStreamingAnswer || createConversation.isPending) {
      return;
    }

    if (currentKnowledgeBaseId.length === 0) {
      setSubmitErrorMessage("请先选择知识库。");
      return;
    }

    if (activeConversationId && !activeConversation) {
      setSubmitErrorMessage("当前会话不属于已选知识库，已为你切换回当前知识库。");
      navigate("/app/chat", { replace: true });
      return;
    }

    setSubmitErrorMessage("");
    let targetConversationId = activeConversationId;
    let hasStartedStreaming = false;

    try {
      if (!targetConversationId) {
        const createdConversation = await createConversation.mutateAsync({});
        targetConversationId = createdConversation.id;
        navigate(`/app/chat/${createdConversation.id}`);
      }

      const tempAssistantMessageId = `stream-${Date.now()}`;
      const streamController = new AbortController();
      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = streamController;
      setIsStreamingAnswer(true);
      setStreamingAssistantMessage({
        id: tempAssistantMessageId,
        role: "assistant",
        content: "正在生成...",
        createdAt: new Date().toLocaleString("zh-CN", {
          hour12: false,
        }),
        citations: [],
        trace: undefined,
      });
      hasStartedStreaming = true;

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

      await invalidateConversationData(result.conversationId);
      setStreamingAssistantMessage(null);
      hasStartedStreaming = false;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStreamingAssistantMessage(null);
      } else if (error instanceof AxiosError<ApiErrorPayload>) {
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
      if (hasStartedStreaming && targetConversationId) {
        await invalidateConversationData(targetConversationId);
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

  return {
    isStreamingAnswer,
    isSubmitting: isStreamingAnswer || createConversation.isPending,
    streamingAssistantMessage,
    submitErrorMessage,
    handleAbortStreaming,
    handleSubmit,
  };
}
