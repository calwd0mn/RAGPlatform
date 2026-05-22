import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { NavigateFunction } from "react-router-dom";
import { queryKeys } from "../../constants/queryKeys";
import { askRagStream, RagStreamHttpError } from "../../services/rag";
import type { ApiErrorPayload } from "../../types/api";
import type { ChatMessage, ConversationItem } from "../../types/chat";
import type { RagAskMode } from "../../types/rag";

const AUTO_RETRY_DELAY_MS = 500;
const AUTO_RETRY_LIMIT = 1;

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
  canRetryLastFailed: boolean;
  handleAbortStreaming: () => void;
  handleRetryLastFailed: () => Promise<void>;
  handleSubmit: (query: string, mode: RagAskMode) => Promise<void>;
}

interface StreamRequestContext {
  conversationId: string;
  query: string;
  mode: RagAskMode;
  requestId: string;
  navigateAfterSuccess: boolean;
  autoRetryCount: number;
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

function canRetryStreamError(error: Error): boolean {
  if (error instanceof RagStreamHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return true;
}

function shouldKeepManualRetry(error: Error): boolean {
  if (error instanceof RagStreamHttpError) {
    return (
      error.status === 408 ||
      error.status === 409 ||
      error.status === 429 ||
      error.status >= 500
    );
  }

  return true;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
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
  const [canRetryLastFailed, setCanRetryLastFailed] = useState(false);
  const streamingAbortControllerRef = useRef<AbortController | null>(null);
  const lastFailedRequestRef = useRef<StreamRequestContext | null>(null);
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
    setCanRetryLastFailed(false);
    lastFailedRequestRef.current = null;
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

  const runStreamingRequest = useCallback(
    async (request: StreamRequestContext): Promise<void> => {
      const tempAssistantMessageId = `stream-${Date.now()}`;
      const streamController = new AbortController();
      let hasStartedStreaming = false;

      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = streamController;
      setSubmitErrorMessage("");
      setCanRetryLastFailed(false);
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
        requestId: request.requestId,
        status: "streaming",
      });
      setStreamingUserMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: request.query,
        createdAt: new Date().toLocaleString("zh-CN", {
          hour12: false,
        }),
        requestId: request.requestId,
      });
      hasStartedStreaming = true;

      try {
        const result = await askRagStream(
          {
            conversationId: request.conversationId,
            query: request.query,
            mode: request.mode,
            requestId: request.requestId,
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
        lastFailedRequestRef.current = null;
        setCanRetryLastFailed(false);
        hasStartedStreaming = false;
        if (request.navigateAfterSuccess) {
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
        } else if (error instanceof Error) {
          if (
            canRetryStreamError(error) &&
            request.autoRetryCount < AUTO_RETRY_LIMIT
          ) {
            try {
              await delay(AUTO_RETRY_DELAY_MS, streamController.signal);
            } catch (retryDelayError) {
              if (
                retryDelayError instanceof DOMException &&
                retryDelayError.name === "AbortError"
              ) {
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
                return;
              }

              throw retryDelayError;
            }

            hasStartedStreaming = false;
            await runStreamingRequest({
              ...request,
              autoRetryCount: request.autoRetryCount + 1,
            });
            return;
          }

          setSubmitErrorMessage(getGenericErrorMessage(error));
          setStreamingAssistantMessage(null);
          setStreamingUserMessage(null);
          if (shouldKeepManualRetry(error)) {
            lastFailedRequestRef.current = {
              ...request,
              autoRetryCount: 0,
            };
            setCanRetryLastFailed(true);
          } else {
            lastFailedRequestRef.current = null;
            setCanRetryLastFailed(false);
          }
        } else {
          setSubmitErrorMessage("请求失败，请稍后重试。");
          setStreamingAssistantMessage(null);
          setStreamingUserMessage(null);
          lastFailedRequestRef.current = {
            ...request,
            autoRetryCount: 0,
          };
          setCanRetryLastFailed(true);
        }
      } finally {
        if (hasStartedStreaming) {
          await invalidateConversationData(request.conversationId);
        }
        setIsStreamingAnswer(false);
        streamingAbortControllerRef.current = null;
      }
    },
    [invalidateConversationData, navigate],
  );

  const handleSubmit = useCallback(
    async (nextQuery: string, mode: RagAskMode): Promise<void> => {
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
      let shouldNavigateToCreatedConversation = false;

      try {
        if (!targetConversationId) {
          const createdConversation = await createConversationAsync({});
          targetConversationId = createdConversation.id;
          shouldNavigateToCreatedConversation = true;
        }

        const requestId = createRequestId();
        await runStreamingRequest({
          conversationId: targetConversationId,
          query,
          mode,
          requestId,
          navigateAfterSuccess: shouldNavigateToCreatedConversation,
          autoRetryCount: 0,
        });
      } catch (error) {
        if (error instanceof AxiosError) {
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
      }
    },
    [
      activeConversation,
      activeConversationId,
      createConversationAsync,
      currentKnowledgeBaseId,
      isCreatingConversation,
      isStreamingAnswer,
      navigate,
      runStreamingRequest,
    ],
  );

  const handleRetryLastFailed = useCallback(async (): Promise<void> => {
    const failedRequest = lastFailedRequestRef.current;
    if (!failedRequest || isStreamingAnswer || isCreatingConversation) {
      return;
    }

    await runStreamingRequest({
      ...failedRequest,
      autoRetryCount: 0,
    });
  }, [isCreatingConversation, isStreamingAnswer, runStreamingRequest]);

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
    canRetryLastFailed,
    handleAbortStreaming,
    handleRetryLastFailed,
    handleSubmit,
  };
}
