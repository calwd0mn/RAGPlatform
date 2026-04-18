import { Alert, Empty, Space, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ChatMessage } from "../../types/chat";
import type { CitationWorkspaceSelection } from "../../types/citation";
import { buildCitationDocumentGroups } from "../../utils/citation-workbench";
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
  const citations = message?.citations ?? [];
  const trace = message?.trace;
  const isNoRetrievedDocument = trace?.retrievedCount === 0;
  const citationGroups = useMemo(
    () => buildCitationDocumentGroups(citations),
    [citations],
  );
  const aggregatedCount = citationGroups.reduce(
    (total, group) => total + group.aggregatedCount,
    0,
  );

  if (!message) {
    return (
      <Empty
        description="当前会话还没有 assistant 回答"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (!citations.length) {
    return (
      <Space direction="vertical" size={12} className={styles.panelStack}>
        {isNoRetrievedDocument ? (
          <Alert
            type="warning"
            showIcon
            title="retrievedCount = 0，本轮没有召回到文档。"
          />
        ) : null}
        <Empty
          description={
            isNoRetrievedDocument
              ? "未检索到文档，当前回答没有 citations。"
              : "该回答没有 citations 数据。"
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={12} className={styles.panelStack}>
      {isNoRetrievedDocument ? (
        <Alert
          type="info"
          showIcon
          title="本轮 retrievedCount 为 0，未检索到可用文档。"
        />
      ) : null}

      <Space size={8} wrap>
        <Tag color="blue">证据数 {citations.length}</Tag>
        <Tag color="processing">聚合后 {aggregatedCount}</Tag>
        <Tag>文档组 {citationGroups.length}</Tag>
        <Tag>Trace {trace ? "已返回" : "缺失"}</Tag>
        {typeof trace?.latencyMs === "number" ? <Tag>Latency {trace.latencyMs} ms</Tag> : null}
      </Space>

      <Space direction="vertical" size={10} className={styles.list}>
        {citationGroups.map((group) => (
          <section key={group.key} className={styles.groupSection}>
            <header className={styles.groupHeader}>
              <Typography.Text strong className={styles.groupTitle}>
                {group.documentName}
              </Typography.Text>
              <Space size={6} wrap>
                <Tag color="blue">
                  片段 {group.aggregatedCount}/{group.rawCount}
                </Tag>
                {group.documentId ? <Tag>{group.documentId}</Tag> : null}
              </Space>
            </header>

            <Space direction="vertical" size={10} className={styles.groupList}>
              {group.items.map((item) => {
                const isSelected =
                  selectedCitation?.assistantMessageId === message.id &&
                  selectedCitation.citationIndex === item.citationIndex;

                return (
                  <CitationCard
                    key={`${message.id}-${item.key}`}
                    citation={item.citation}
                    index={item.citationIndex}
                    citationOrder={item.citationIndex}
                    mergedCitationIndices={item.mergedCitationIndices}
                    selected={isSelected}
                    beforeContext={item.beforeContext?.content}
                    afterContext={item.afterContext?.content}
                    onSelect={() => onCitationSelect(message, item.citationIndex)}
                    onViewDocument={() => {
                      onCitationSelect(message, item.citationIndex);
                      if (!item.citation.documentId) {
                        return;
                      }

                      const query = buildDocumentLocationQuery({
                        documentId: item.citation.documentId,
                        page: item.citation.page,
                        chunkId: item.citation.chunkId,
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
          </section>
        ))}
      </Space>
    </Space>
  );
}
