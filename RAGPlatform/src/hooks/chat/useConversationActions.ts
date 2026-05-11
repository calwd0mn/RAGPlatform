import { useCallback, useState } from "react";
import { AxiosError } from "axios";
import { message } from "antd";
import type { NavigateFunction } from "react-router-dom";
import { useCreateConversation } from "./useCreateConversation";
import { useDeleteConversation } from "./useDeleteConversation";
import { useUpdateConversation } from "./useUpdateConversation";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

interface UseConversationActionsOptions {
  activeConversationId: string;
  navigate: NavigateFunction;
}

interface UseConversationActionsResult {
  createConversationMutation: ReturnType<typeof useCreateConversation>;
  deletingConversationId: string;
  deleteConversationMutation: ReturnType<typeof useDeleteConversation>;
  handleCloseRenameConversation: () => void;
  handleCreateConversation: () => void;
  handleDeleteConversation: (conversation: ConversationItem) => Promise<void>;
  handleOpenRenameConversation: (conversation: ConversationItem) => void;
  handleRenameConversation: (title: string) => Promise<void>;
  renameTargetConversation: ConversationItem | null;
  updateConversationMutation: ReturnType<typeof useUpdateConversation>;
}

function getApiErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "请求失败，请稍后重试。";
  }

  const { message: errorMessage } = error.response.data;
  return Array.isArray(errorMessage) ? errorMessage.join("；") : errorMessage;
}

export function useConversationActions(
  options: UseConversationActionsOptions,
): UseConversationActionsResult {
  const { activeConversationId, navigate } = options;
  const [renameTargetConversation, setRenameTargetConversation] =
    useState<ConversationItem | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState("");
  const createConversationMutation = useCreateConversation();
  const updateConversationMutation = useUpdateConversation();
  const deleteConversationMutation = useDeleteConversation();
  const { mutateAsync: updateConversation } = updateConversationMutation;
  const { mutateAsync: deleteConversation } = deleteConversationMutation;

  const handleCreateConversation = useCallback(() => {
    navigate("/app/chat");
  }, [navigate]);

  const handleOpenRenameConversation = useCallback(
    (conversation: ConversationItem) => {
      setRenameTargetConversation(conversation);
    },
    [],
  );

  const handleCloseRenameConversation = useCallback(() => {
    setRenameTargetConversation(null);
  }, []);

  const handleRenameConversation = useCallback(
    async (title: string) => {
      if (!renameTargetConversation) {
        return;
      }

      await updateConversation({
        conversationId: renameTargetConversation.id,
        title,
      });
      setRenameTargetConversation(null);
    },
    [renameTargetConversation, updateConversation],
  );

  const handleDeleteConversation = useCallback(
    async (conversation: ConversationItem) => {
      setDeletingConversationId(conversation.id);
      try {
        await deleteConversation({
          conversationId: conversation.id,
        });

        if (conversation.id !== activeConversationId) {
          return;
        }

        navigate("/app/chat", { replace: true });
      } catch (error) {
        if (error instanceof AxiosError) {
          message.error(getApiErrorMessage(error));
        } else if (error instanceof Error) {
          message.error(error.message);
        } else {
          message.error("请求失败，请稍后重试。");
        }
      } finally {
        setDeletingConversationId("");
      }
    },
    [activeConversationId, deleteConversation, navigate],
  );

  return {
    createConversationMutation,
    deletingConversationId,
    deleteConversationMutation,
    handleCloseRenameConversation,
    handleCreateConversation,
    handleDeleteConversation,
    handleOpenRenameConversation,
    handleRenameConversation,
    renameTargetConversation,
    updateConversationMutation,
  };
}
