import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./AssistantMessageCard.module.css";

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
}: MarkdownContentProps) {
  return (
    <div className={styles.markdownBody}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
});
