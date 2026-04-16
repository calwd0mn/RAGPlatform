import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { sendMessage } from "../../services/messages";
import type { ApiErrorPayload } from "../../types/api";
import type { ChatMessage } from "../../types/chat";

interface SendMessageVariables {
  conversationId: string;
  content: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, AxiosError<ApiErrorPayload>, SendMessageVariables>({
    mutationFn: (variables) => sendMessage(variables),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.list(variables.conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.list,
        }),
      ]);
    },
  });
}
