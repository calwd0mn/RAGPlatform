import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "antd";
import type {
  EvidenceTabKey,
  PanelTabRequest,
} from "../../hooks/chat/useActiveAssistantWorkspace";
import type { ChatMessage } from "../../types/chat";
import type { CitationWorkspaceSelection } from "../../types/citation";
import { EvidencePanel } from "./EvidencePanel";
import { TracePanel } from "./TracePanel";

interface AssistantWorkspaceTabsProps {
  activeConversationId: string;
  message?: ChatMessage;
  selectedCitation?: CitationWorkspaceSelection | null;
  panelTabRequest: PanelTabRequest;
  onCitationSelect: (message: ChatMessage, citationIndex: number) => void;
}

export const AssistantWorkspaceTabs = memo(function AssistantWorkspaceTabs({
  activeConversationId,
  message,
  selectedCitation,
  panelTabRequest,
  onCitationSelect,
}: AssistantWorkspaceTabsProps) {
  const [activePanelTab, setActivePanelTab] =
    useState<EvidenceTabKey>("evidence");

  useEffect(() => {
    setActivePanelTab(panelTabRequest.tab);
  }, [panelTabRequest]);

  const handlePanelTabChange = useCallback((nextTab: string) => {
    if (nextTab === "evidence" || nextTab === "trace") {
      setActivePanelTab(nextTab);
    }
  }, []);

  const evidenceTabItems = useMemo(
    () => [
      {
        key: "evidence",
        label: "Evidence",
        children: (
          <EvidencePanel
            conversationId={activeConversationId}
            message={message}
            selectedCitation={selectedCitation}
            onCitationSelect={onCitationSelect}
          />
        ),
      },
      {
        key: "trace",
        label: "Trace",
        children: <TracePanel message={message} />,
      },
    ],
    [activeConversationId, message, onCitationSelect, selectedCitation],
  );

  return (
    <Tabs
      activeKey={activePanelTab}
      onChange={handlePanelTabChange}
      items={evidenceTabItems}
    />
  );
});
