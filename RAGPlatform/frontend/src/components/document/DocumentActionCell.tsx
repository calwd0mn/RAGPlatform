import { Button, Popconfirm, Space, Tag } from "antd";
import type { DocumentRecord } from "../../types/document";
import { toDocumentDisplayStatus } from "../../utils/document-status";

interface DocumentActionCellProps {
  record: DocumentRecord;
  startIngestionPending: boolean;
  startingDocumentId?: string;
  deletePending: boolean;
  deletingDocumentId?: string;
  onStartIngestion: (documentId: string) => void;
  onDeleteDocument: (documentId: string) => void;
}

export function DocumentActionCell({
  record,
  startIngestionPending,
  startingDocumentId,
  deletePending,
  deletingDocumentId,
  onStartIngestion,
  onDeleteDocument,
}: DocumentActionCellProps) {
  const displayStatus = toDocumentDisplayStatus(record.status);
  const isStartingCurrent = startIngestionPending && startingDocumentId === record.id;
  const isDeletingCurrent = deletePending && deletingDocumentId === record.id;
  const disableIngestionAction = startIngestionPending || deletePending;

  return (
    <Space size={8}>
      {displayStatus === "uploaded" ? (
        <Button
          type="link"
          size="small"
          loading={isStartingCurrent}
          disabled={disableIngestionAction}
          onClick={() => onStartIngestion(record.id)}
        >
          开始入库
        </Button>
      ) : null}

      {displayStatus === "failed" ? (
        <Button
          type="link"
          size="small"
          danger
          loading={isStartingCurrent}
          disabled={disableIngestionAction}
          onClick={() => onStartIngestion(record.id)}
        >
          重试入库
        </Button>
      ) : null}

      {displayStatus === "processing" ? (
        <Button type="link" size="small" disabled>
          处理中
        </Button>
      ) : null}

      {displayStatus === "ready" ? <Tag color="success">可问答</Tag> : null}

      <Popconfirm
        title="确认删除该文档？"
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onConfirm={() => onDeleteDocument(record.id)}
        disabled={deletePending}
      >
        <Button type="link" danger size="small" loading={isDeletingCurrent} disabled={deletePending}>
          删除
        </Button>
      </Popconfirm>
    </Space>
  );
}
