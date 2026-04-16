import { Button, Space, Tag, Tooltip, Typography } from "antd";
import type { RagCitation } from "../../types/rag";
import styles from "./CitationCard.module.css";

interface CitationCardProps {
  citation: RagCitation;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onViewDocument: () => void;
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
  onSelect,
  onViewDocument,
}: CitationCardProps) {
  const canViewDocument = Boolean(citation.documentId);

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
        <Typography.Text strong className={styles.title}>
          {renderSourceName(citation.documentName, index)}
        </Typography.Text>

        <Typography.Paragraph
          ellipsis={{ rows: 3, expandable: false }}
          type="secondary"
          className={styles.excerpt}
        >
          {citation.content?.trim() || "该证据未返回可展示摘录。"}
        </Typography.Paragraph>

        <div className={styles.footer}>
          <div className={styles.metaTags}>
            {typeof citation.score === "number" ? (
              <Tag color="cyan">匹配度 {Math.round(citation.score * 100)}%</Tag>
            ) : null}
            {typeof citation.page === "number" ? <Tag>页码 {citation.page}</Tag> : null}
            {citation.chunkId ? <Tag>{citation.chunkId}</Tag> : null}
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

