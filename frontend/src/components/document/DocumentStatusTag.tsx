import { Tag } from "antd";
import type { DocumentStatus } from "../../types/document";
import { getDocumentDisplayMeta } from "../../utils/document-status";

interface DocumentStatusTagProps {
  status: DocumentStatus;
}

export function DocumentStatusTag({ status }: DocumentStatusTagProps) {
  const meta = getDocumentDisplayMeta(status);
  return <Tag color={meta.color}>{meta.label}</Tag>;
}
