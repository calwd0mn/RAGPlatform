import { Button, Space, Tag, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";
import { CitationContextPreview } from "../../features/evidence/components/CitationContextPreview";
import type { RagCitation } from "../../types/rag";
import styles from "./CitationCard.module.css";

interface CitationCardProps {
  citation: RagCitation;
  index: number;
  selected: boolean;
  citationOrder?: number;
  mergedCitationIndices?: number[];
  onSelect: () => void;
  onViewDocument: () => void;
  beforeContext?: string;
  afterContext?: string;
}

function renderSourceName(documentName: string | undefined, index: number): string {
  if (!documentName || !documentName.trim()) {
    return `证据片段 ${index + 1}`;
  }
  return documentName;
}

export function CitationCard({
  citation,
  index,
  selected,
  citationOrder,
  mergedCitationIndices,
  onSelect,
  onViewDocument,
  beforeContext,
  afterContext,
}: CitationCardProps) {
  const canViewDocument = Boolean(citation.documentId);
  const [contextExpanded, setContextExpanded] = useState(false);
  const citationIndexLabel = (citationOrder ?? index) + 1;
  const mergedCount = mergedCitationIndices?.length ?? 1;
  const mergedLabel = useMemo(() => {
    if (!mergedCitationIndices?.length || mergedCitationIndices.length <= 1) {
      return "";
    }
    return mergedCitationIndices
      .map((item) => `${item + 1}`)
      .join(", ");
  }, [mergedCitationIndices]);
  const hasContext =
    Boolean(citation.chunkId) ||
    Boolean(beforeContext?.trim() || afterContext?.trim());
  const excerpt = citation.content?.trim() || "该证据未返回可展示摘录。";

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
    >
      <Space direction="vertical" size={6} className={styles.metaStack}>
        <div className={styles.titleRow}>
          <Typography.Text strong className={styles.title}>
            [{citationIndexLabel}] {renderSourceName(citation.documentName, index)}
          </Typography.Text>
          {mergedCount > 1 ? <Tag color="gold">聚合 {mergedCount}</Tag> : null}
        </div>

        <Typography.Paragraph
          ellipsis={{ rows: 3, expandable: false }}
          type="secondary"
          className={styles.excerpt}
        >
          {excerpt}
        </Typography.Paragraph>

        {hasContext ? (
          <div className={styles.contextPanel}>
            <Button
              type="link"
              size="small"
              className={styles.contextToggle}
              onClick={(event) => {
                event.stopPropagation();
                setContextExpanded((value) => !value);
              }}
            >
              {contextExpanded ? "收起上下文" : "展开上下文"}
            </Button>
            {contextExpanded ? (
              <div className={styles.contextStack}>
                <CitationContextPreview
                  chunkId={citation.chunkId}
                  excerpt={excerpt}
                  fallbackBefore={beforeContext}
                  fallbackAfter={afterContext}
                  expanded={contextExpanded}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.metaTags}>
            {typeof citation.score === "number" ? (
              <Tag color="cyan">匹配度 {Math.round(citation.score * 100)}%</Tag>
            ) : null}
            {typeof citation.page === "number" ? <Tag>页码 {citation.page}</Tag> : null}
            {citation.chunkId ? <Tag>{citation.chunkId}</Tag> : null}
            {mergedCount > 1 && mergedLabel ? <Tag>引用位次 {mergedLabel}</Tag> : null}
          </div>
          <Tooltip title={canViewDocument ? "跳转到文档中心定位该片段" : "缺少 documentId，无法定位"}>
            <Button
              type="link"
              size="small"
              className={styles.viewButton}
              onClick={(event) => {
                event.stopPropagation();
                onViewDocument();
              }}
              disabled={!canViewDocument}
            >
              查看文档
            </Button>
          </Tooltip>
        </div>
      </Space>
    </div>
  );
}
