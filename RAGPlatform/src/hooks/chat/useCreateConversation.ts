import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { queryKeys } from "../../constants/queryKeys";
import { createConversation } from "../../services/conversations";
import type { ApiErrorPayload } from "../../types/api";
import type { ConversationItem } from "../../types/chat";

function upsertConversationList(
  currentList: ConversationItem[] | undefined,
  createdConversation: ConversationItem,
): ConversationItem[] {
  const existingList = currentList ?? [];
  const withoutCreated = existingList.filter(
    (conversation) => conversation.id !== createdConversation.id,
  );
  return [createdConversation, ...withoutCreated];
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<ConversationItem, AxiosError<ApiErrorPayload>, { title?: string }>({
    mutationFn: (payload) => createConversation(payload),
    onSuccess: (createdConversation) => {
      queryClient.setQueryData<ConversationItem[]>(
        queryKeys.conversations.list,
        (currentList) => upsertConversationList(currentList, createdConversation),
      );
    },
  });
}
