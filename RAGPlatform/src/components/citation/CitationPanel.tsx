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
                {item.sourceName}
              </Typography.Text>
            }
            description={
              <>
                <Typography.Paragraph
                  ellipsis={{ rows: 2, expandable: false }}
                  type="secondary"
                  className={styles.excerpt}
                >
                  {item.excerpt}
                </Typography.Paragraph>
                <Tag color="cyan">匹配度 {Math.round(item.score * 100)}%</Tag>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}
