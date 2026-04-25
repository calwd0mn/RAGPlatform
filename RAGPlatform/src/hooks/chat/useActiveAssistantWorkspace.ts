import { useCallback, useEffect, useMemo, useState } from "react";
import { useCitationWorkspaceStore } from "../../stores/citation-workspace.store";
import type { ChatMessage } from "../../types/chat";
import type { RagCitation } from "../../types/rag";

type EvidenceTabKey = "evidence" | "trace";

interface UseActiveAssistantWorkspaceOptions {
  activeConversationId: string;
  messages: ChatMessage[];
}

interface UseActiveAssistantWorkspaceResult {
  activeAssistantMessage: ChatMessage | undefined;
  activePanelTab: EvidenceTabKey;
  currentConversationSelectedCitation: ReturnType<
    typeof useCitationWorkspaceStore.getState
  >["selectedCitation"];
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
  handlePanelTabChange: (nextTab: string) => void;
}

export function useActiveAssistantWorkspace(
  options: UseActiveAssistantWorkspaceOptions,
): UseActiveAssistantWorkspaceResult {
  const { activeConversationId, messages } = options;
  const [activePanelTab, setActivePanelTab] = useState<EvidenceTabKey>("evidence");
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<
    string | null
  >(null);
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
    () => messages.filter((item): item is ChatMessage => item.role === "assistant"),
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
  }, [activeConversationId, clearSelectedCitation]);

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

  const focusEvidencePanelForMessage = useCallback(
    (messageId: string) => {
      setActiveAssistantMessageId(messageId);
      setActivePanelTab("evidence");
      if (selectedCitation?.assistantMessageId !== messageId) {
        clearSelectedCitation();
      }
    },
    [clearSelectedCitation, selectedCitation],
  );

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

  return {
    activeAssistantMessage,
    activePanelTab,
    currentConversationSelectedCitation,
    focusEvidencePanelForMessage,
    handleAssistantPanelNavigate,
    handleCitationSelect,
    handleEvidenceCitationSelect,
    handlePanelTabChange,
  };
}
