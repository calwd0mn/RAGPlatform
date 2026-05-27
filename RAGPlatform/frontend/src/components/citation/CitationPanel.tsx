import { List, Tag, Typography } from "antd";
import type { CitationItem } from "../../types/chat";
import styles from "./CitationPanel.module.css";

interface CitationPanelProps {
  items: CitationItem[];
}

export function CitationPanel({ items }: CitationPanelProps) {
  return (
    <List
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={
              <Typography.Text strong className={styles.titleText}>
                {item.documentName?.trim() || "未命名文档"}
              </Typography.Text>
            }
            description={
              <>
                <Typography.Paragraph
                  ellipsis={{ rows: 2, expandable: false }}
                  type="secondary"
                  className={styles.excerpt}
                >
                  {item.content?.trim() || "该证据未返回可展示摘录。"}
                </Typography.Paragraph>
                {typeof item.score === "number" ? (
                  <Tag color="cyan">匹配度 {Math.round(item.score * 100)}%</Tag>
                ) : null}
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}
