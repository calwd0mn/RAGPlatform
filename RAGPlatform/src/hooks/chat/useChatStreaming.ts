import { useCallback, useEffect, useRef, useState } from "react";
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
  streamingUserMessage: ChatMessage | null;
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

function createRequestId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
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
  const [streamingUserMessage, setStreamingUserMessage] =
    useState<ChatMessage | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");
  const streamingAbortControllerRef = useRef<AbortController | null>(null);
  const {
    isPending: isCreatingConversation,
    mutateAsync: createConversationAsync,
  } = createConversation;

  useEffect(() => {
    streamingAbortControllerRef.current?.abort();
    streamingAbortControllerRef.current = null;
    setIsStreamingAnswer(false);
    setStreamingAssistantMessage(null);
    setStreamingUserMessage(null);
    setSubmitErrorMessage("");
  }, [activeConversationId]);

  useEffect(
    () => () => {
      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = null;
    },
    [],
  );

  const invalidateConversationData = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.list(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.list(currentKnowledgeBaseId),
        }),
      ]);
    },
    [currentKnowledgeBaseId, queryClient],
  );

  const handleSubmit = useCallback(
    async (nextQuery: string): Promise<void> => {
      const query = nextQuery.trim();
      if (!query || isStreamingAnswer || isCreatingConversation) {
        return;
      }

      if (currentKnowledgeBaseId.length === 0) {
        setSubmitErrorMessage("请先选择知识库。");
        return;
      }

      if (activeConversationId && !activeConversation) {
        setSubmitErrorMessage(
          "当前会话不属于已选知识库，已为你切换回当前知识库。",
        );
        navigate("/app/chat", { replace: true });
        return;
      }

      setSubmitErrorMessage("");
      let targetConversationId = activeConversationId;
      let hasStartedStreaming = false;
      let shouldNavigateToCreatedConversation = false;

      try {
        if (!targetConversationId) {
          const createdConversation = await createConversationAsync({});
          targetConversationId = createdConversation.id;
          shouldNavigateToCreatedConversation = true;
        }

        const tempAssistantMessageId = `stream-${Date.now()}`;
        const requestId = createRequestId();
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
          requestId,
          status: "streaming",
        });
        setStreamingUserMessage({
          id: `user-${Date.now()}`,
          role: "user",
          content: query,
          createdAt: new Date().toLocaleString("zh-CN", {
            hour12: false,
          }),
          requestId,
        });
        hasStartedStreaming = true;

        const result = await askRagStream(
          {
            conversationId: targetConversationId,
            query,
            requestId,
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
        setStreamingUserMessage(null);
        hasStartedStreaming = false;
        if (shouldNavigateToCreatedConversation) {
          navigate(`/app/chat/${result.conversationId}`);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStreamingAssistantMessage((previous) => {
            if (!previous) {
              return previous;
            }

            return {
              ...previous,
              content:
                previous.content === "正在生成..."
                  ? "已停止生成。"
                  : previous.content,
              status: "interrupted",
            };
          });
        } else if (error instanceof AxiosError) {
          setSubmitErrorMessage(getApiErrorMessage(error));
          setStreamingAssistantMessage(null);
          setStreamingUserMessage(null);
        } else if (error instanceof Error) {
          setSubmitErrorMessage(getGenericErrorMessage(error));
          setStreamingAssistantMessage(null);
          setStreamingUserMessage(null);
        } else {
          setSubmitErrorMessage("请求失败，请稍后重试。");
          setStreamingAssistantMessage(null);
          setStreamingUserMessage(null);
        }
      } finally {
        if (hasStartedStreaming && targetConversationId) {
          await invalidateConversationData(targetConversationId);
        }
        setIsStreamingAnswer(false);
        streamingAbortControllerRef.current = null;
      }
    },
    [
      activeConversation,
      activeConversationId,
      createConversationAsync,
      currentKnowledgeBaseId,
      invalidateConversationData,
      isCreatingConversation,
      isStreamingAnswer,
      navigate,
    ],
  );

  const handleAbortStreaming = useCallback(() => {
    const activeController = streamingAbortControllerRef.current;
    if (!activeController) {
      return;
    }

    activeController.abort();
  }, []);

  return {
    isStreamingAnswer,
    isSubmitting: isStreamingAnswer || isCreatingConversation,
    streamingAssistantMessage,
    streamingUserMessage,
    submitErrorMessage,
    handleAbortStreaming,
    handleSubmit,
  };
}
