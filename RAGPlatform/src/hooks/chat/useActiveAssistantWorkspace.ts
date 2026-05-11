import { useCallback, useEffect, useMemo, useState } from "react";
import { useCitationWorkspaceStore } from "../../stores/citation-workspace.store";
import type { ChatMessage } from "../../types/chat";
import type { RagCitation } from "../../types/rag";

export type EvidenceTabKey = "evidence" | "trace";

export interface PanelTabRequest {
  tab: EvidenceTabKey;
  requestId: number;
}

interface FocusedAssistantMessage {
  conversationId: string;
  messageId: string;
}

interface UseActiveAssistantWorkspaceOptions {
  activeConversationId: string;
  messages: ChatMessage[];
}

interface UseActiveAssistantWorkspaceResult {
  activeAssistantMessage: ChatMessage | undefined;
  currentConversationSelectedCitation: ReturnType<
    typeof useCitationWorkspaceStore.getState
  >["selectedCitation"];
  panelTabRequest: PanelTabRequest;
  focusEvidencePanelForMessage: (messageId: string) => void;
  handleAssistantPanelNavigate: (
    messageId: string,
    tab: EvidenceTabKey,
  ) => void;
  handleCitationSelect: (
    message: ChatMessage,
    citation: RagCitation,
    citationIndex: number,
  ) => void;
  handleEvidenceCitationSelect: (
    message: ChatMessage,
    citationIndex: number,
  ) => void;
}

export function useActiveAssistantWorkspace(
  options: UseActiveAssistantWorkspaceOptions,
): UseActiveAssistantWorkspaceResult {
  const { activeConversationId, messages } = options;
  const [focusedAssistantMessage, setFocusedAssistantMessage] =
    useState<FocusedAssistantMessage | null>(null);
  const [panelTabRequest, setPanelTabRequest] = useState<PanelTabRequest>({
    tab: "evidence",
    requestId: 0,
  });
  const selectedCitation = useCitationWorkspaceStore(
    (state) => state.selectedCitation,
  );
  const setSelectedCitation = useCitationWorkspaceStore(
    (state) => state.setSelectedCitation,
  );
  const clearSelectedCitation = useCitationWorkspaceStore(
    (state) => state.clearSelectedCitation,
  );

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
    const focusedAssistantMessageId =
      focusedAssistantMessage?.conversationId === activeConversationId
        ? focusedAssistantMessage.messageId
        : null;
    if (focusedAssistantMessageId) {
      const matchedMessage = assistantMessages.find(
        (item) => item.id === focusedAssistantMessageId,
      );
      if (matchedMessage) {
        return matchedMessage;
      }
    }
    return assistantMessages[assistantMessages.length - 1];
  }, [
    activeConversationId,
    assistantMessages,
    currentConversationSelectedCitation,
    focusedAssistantMessage,
  ]);

  const requestPanelTab = useCallback((tab: EvidenceTabKey) => {
    setPanelTabRequest((previous) => ({
      tab,
      requestId: previous.requestId + 1,
    }));
  }, []);

  useEffect(() => {
    clearSelectedCitation();
  }, [activeConversationId, clearSelectedCitation]);

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

  const focusEvidencePanelForMessage = useCallback(
    (messageId: string) => {
      setFocusedAssistantMessage({
        conversationId: activeConversationId,
        messageId,
      });
      requestPanelTab("evidence");
      if (selectedCitation?.assistantMessageId !== messageId) {
        clearSelectedCitation();
      }
    },
    [
      activeConversationId,
      clearSelectedCitation,
      requestPanelTab,
      selectedCitation,
    ],
  );

  const handleAssistantPanelNavigate = useCallback(
    (messageId: string, tab: EvidenceTabKey) => {
      setFocusedAssistantMessage({
        conversationId: activeConversationId,
        messageId,
      });
      requestPanelTab(tab);
      if (selectedCitation?.assistantMessageId !== messageId) {
        clearSelectedCitation();
      }
    },
    [
      activeConversationId,
      clearSelectedCitation,
      requestPanelTab,
      selectedCitation,
    ],
  );

  const handleCitationSelect = useCallback(
    (message: ChatMessage, citation: RagCitation, citationIndex: number) => {
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
      setFocusedAssistantMessage({
        conversationId: activeConversationId,
        messageId: message.id,
      });
      requestPanelTab("evidence");
    },
    [activeConversationId, requestPanelTab, setSelectedCitation],
  );

  const handleEvidenceCitationSelect = useCallback(
    (message: ChatMessage, citationIndex: number) => {
      const citations = message.citations ?? [];
      const targetCitation = citations[citationIndex];
      if (!targetCitation) {
        return;
      }

      handleCitationSelect(message, targetCitation, citationIndex);
    },
    [handleCitationSelect],
  );

  return {
    activeAssistantMessage,
    currentConversationSelectedCitation,
    panelTabRequest,
    focusEvidencePanelForMessage,
    handleAssistantPanelNavigate,
    handleCitationSelect,
    handleEvidenceCitationSelect,
  };
}
