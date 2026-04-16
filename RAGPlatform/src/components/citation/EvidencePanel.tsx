import { Alert, Empty, Space, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import type { ChatMessage } from "../../types/chat";
import type { CitationWorkspaceSelection } from "../../types/citation";
import { buildDocumentLocationQuery } from "../../utils/document-location";
import { CitationCard } from "./CitationCard";
import styles from "./EvidencePanel.module.css";

interface EvidencePanelProps {
  conversationId: string;
  message?: ChatMessage;
  selectedCitation?: CitationWorkspaceSelection | null;
  onCitationSelect: (message: ChatMessage, citationIndex: number) => void;
}

export function EvidencePanel({
  conversationId,
  message,
  selectedCitation,
  onCitationSelect,
}: EvidencePanelProps) {
  const navigate = useNavigate();

  if (!message) {
    return <Empty description="当前会话还没有 assistant 回答" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const citations = message.citations ?? [];

  if (!citations.length) {
    return (
      <Space direction="vertical" size={12} className={styles.panelStack}>
        <Empty description="该回答没有 citations 数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={12} className={styles.panelStack}>
      {message.trace?.retrievedCount === 0 ? (
        <Alert
          type="info"
          showIcon
          title="本轮 retrievedCount 为 0，未检索到可用文档。"
        />
      ) : null}

      <Space size={8} wrap>
        <Tag color="blue">证据数 {citations.length}</Tag>
      </Space>

      <Space direction="vertical" size={10} className={styles.list}>
        {citations.map((item, index) => {
          const isSelected =
            selectedCitation?.assistantMessageId === message.id &&
            selectedCitation.citationIndex === index;

          return (
            <CitationCard
              key={`${message.id}-${index}`}
              citation={item}
              index={index}
              selected={isSelected}
              onSelect={() => onCitationSelect(message, index)}
              onViewDocument={() => {
                onCitationSelect(message, index);
                if (!item.documentId) {
                  return;
                }

                const query = buildDocumentLocationQuery({
                  documentId: item.documentId,
                  page: item.page,
                  chunkId: item.chunkId,
                });

                navigate(`/app/documents?${query}`, {
                  state: {
                    source: "citation",
                    conversationId,
                    assistantMessageId: message.id,
                  },
                });
              }}
            />
          );
        })}
      </Space>
    </Space>
  );
}
