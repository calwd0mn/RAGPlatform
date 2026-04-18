import { Avatar, Button, Empty, Space, Tag, Typography } from "antd";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CitationWorkspaceSelection } from "../../types/citation";
import type { ChatMessage } from "../../types/chat";
import type { RagCitation } from "../../types/rag";
import { buildCitationDocumentGroups } from "../../utils/citation-workbench";
import styles from "./AssistantMessageCard.module.css";

interface AssistantMessageCardProps {
  message: ChatMessage;
  selected: boolean;
  selectedCitation?: CitationWorkspaceSelection | null;
  onNavigatePanel?: (messageId: string, tab: "evidence" | "trace") => void;
  onCitationSelect?: (
    message: ChatMessage,
    citation: RagCitation,
    citationIndex: number,
  ) => void;
}

function renderDocumentName(citation: RagCitation, citationIndex: number): string {
  const name = citation.documentName?.trim();
  if (name) {
    return name;
  }
  return `证据片段 ${citationIndex + 1}`;
}

function renderExcerpt(citation: RagCitation): string {
  const excerpt = citation.content?.trim();
  if (excerpt) {
    return excerpt;
  }
  return "该证据未返回可展示摘录。";
}

export function AssistantMessageCard({
  message,
  selected,
  selectedCitation,
  onNavigatePanel,
  onCitationSelect,
}: AssistantMessageCardProps) {
  const citations = message.citations ?? [];
  const trace = message.trace;
  const isNoRetrievedDocument = trace?.retrievedCount === 0;
  const citationGroups = useMemo(
    () => buildCitationDocumentGroups(citations),
    [citations],
  );

  return (
    <div className={`${styles.row} ${selected ? styles.rowSelected : ""}`}>
      <Avatar className={styles.avatar}>AI</Avatar>
      <section className={styles.card}>
        <header className={styles.header}>
          <Space size={8}>
            <Typography.Text strong>Assistant</Typography.Text>
            <Typography.Text type="secondary" className={styles.timeText}>
              {message.createdAt}
            </Typography.Text>
          </Space>
          <Tag color={selected ? "blue" : "default"}>{selected ? "当前焦点" : "历史回答"}</Tag>
        </header>

        <section className={styles.bodySection}>
          <Typography.Text type="secondary" className={styles.sectionLabel}>
            回答正文
          </Typography.Text>
          <div className={styles.bodyContent}>
            <div className={styles.markdownBody}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || "模型未返回正文内容。"}
              </ReactMarkdown>
            </div>
          </div>
        </section>

        <section className={styles.actionSection}>
          <div className={styles.actionHeader}>
            <Typography.Text type="secondary" className={styles.sectionLabel}>
              操作摘要
            </Typography.Text>
            <Space size={8}>
              <Button
                size="small"
                type="link"
                className={styles.actionButton}
                onClick={() => onNavigatePanel?.(message.id, "evidence")}
              >
                查看 Evidence
              </Button>
              <Button
                size="small"
                type="link"
                className={styles.actionButton}
                onClick={() => onNavigatePanel?.(message.id, "trace")}
              >
                查看 Trace
              </Button>
            </Space>
          </div>
          <Space size={[8, 8]} wrap>
            <Tag color="blue">Citations {citations.length}</Tag>
            {typeof trace?.retrievedCount === "number" ? (
              <Tag color={isNoRetrievedDocument ? "warning" : "default"}>
                Retrieved {trace.retrievedCount}
              </Tag>
            ) : (
              <Tag>Retrieved -</Tag>
            )}
            {typeof trace?.latencyMs === "number" ? <Tag>Latency {trace.latencyMs} ms</Tag> : null}
            {trace?.model ? <Tag>{trace.model}</Tag> : null}
          </Space>
        </section>

        <section className={styles.evidenceSection}>
          <Typography.Text type="secondary" className={styles.sectionLabel}>
            证据摘要
          </Typography.Text>
          {!citations.length ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                isNoRetrievedDocument
                  ? "未检索到文档，当前回答没有可展示 citations。"
                  : "当前回答没有 citations。"
              }
            />
          ) : (
            <Space direction="vertical" size={8} className={styles.evidenceList}>
              {citationGroups.map((group) => (
                <section key={`${message.id}-${group.key}`} className={styles.citationGroup}>
                  <div className={styles.citationGroupHeader}>
                    <Typography.Text strong className={styles.citationGroupTitle}>
                      {group.documentName}
                    </Typography.Text>
                    <Tag color="blue">
                      {group.aggregatedCount}/{group.rawCount}
                    </Tag>
                  </div>

                  <Space direction="vertical" size={8} className={styles.evidenceList}>
                    {group.items.map((item) => {
                      const citation = item.citation;
                      const citationIndex = item.citationIndex;
                      const isCitationSelected =
                        selectedCitation?.assistantMessageId === message.id &&
                        selectedCitation.citationIndex === citationIndex;

                      return (
                        <button
                          key={`${message.id}-${group.key}-${citationIndex}`}
                          type="button"
                          className={`${styles.citationSummary} ${
                            isCitationSelected ? styles.citationSummarySelected : ""
                          }`}
                          aria-pressed={isCitationSelected}
                          onClick={() =>
                            onCitationSelect?.(message, citation, citationIndex)
                          }
                        >
                          <div className={styles.citationTitleRow}>
                            <Typography.Text strong className={styles.citationTitle}>
                              [{citationIndex + 1}]{" "}
                              {renderDocumentName(citation, citationIndex)}
                            </Typography.Text>
                            <Space size={6}>
                              {item.mergedCount > 1 ? (
                                <Tag color="gold">聚合 {item.mergedCount}</Tag>
                              ) : null}
                              {typeof citation.page === "number" ? <Tag>页 {citation.page}</Tag> : null}
                              {typeof citation.score === "number" ? (
                                <Tag color="cyan">匹配 {Math.round(citation.score * 100)}%</Tag>
                              ) : null}
                            </Space>
                          </div>
                          <Typography.Paragraph
                            ellipsis={{ rows: 2 }}
                            className={styles.citationExcerpt}
                          >
                            {renderExcerpt(citation)}
                          </Typography.Paragraph>
                        </button>
                      );
                    })}
                  </Space>
                </section>
              ))}
            </Space>
          )}
        </section>
      </section>
    </div>
  );
}
