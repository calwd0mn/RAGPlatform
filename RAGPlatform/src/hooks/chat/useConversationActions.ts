import { useState } from "react";
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
  conversations: ConversationItem[];
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
  const { activeConversationId, conversations, navigate } = options;
  const [renameTargetConversation, setRenameTargetConversation] =
    useState<ConversationItem | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState("");
  const createConversationMutation = useCreateConversation();
  const updateConversationMutation = useUpdateConversation();
  const deleteConversationMutation = useDeleteConversation();

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
    const remainingConversations = conversations.filter(
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
  };

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
