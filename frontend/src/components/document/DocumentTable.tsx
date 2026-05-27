import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DocumentRecord } from "../../types/document";
import { DocumentActionCell } from "./DocumentActionCell";
import { DocumentStatusTag } from "./DocumentStatusTag";
import styles from "./DocumentTable.module.css";

interface DocumentTableProps {
  dataSource: DocumentRecord[];
  highlightedDocumentId?: string;
  loading?: boolean;
  startIngestionPending: boolean;
  startingDocumentId?: string;
  deletePending: boolean;
  deletingDocumentId?: string;
  onStartIngestion: (documentId: string) => void;
  onDeleteDocument: (documentId: string) => void;
}

export function DocumentTable({
  dataSource,
  highlightedDocumentId,
  loading = false,
  startIngestionPending,
  startingDocumentId,
  deletePending,
  deletingDocumentId,
  onStartIngestion,
  onDeleteDocument,
}: DocumentTableProps) {
  const columns: ColumnsType<DocumentRecord> = [
    {
      title: "文件名",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
    },
    {
      title: "类型",
      dataIndex: "fileType",
      key: "fileType",
      width: 100,
    },
    {
      title: "大小",
      dataIndex: "sizeLabel",
      key: "sizeLabel",
      width: 110,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (_, record) => <DocumentStatusTag status={record.status} />,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
    },
    {
      title: "操作",
      key: "action",
      width: 240,
      render: (_, record) => (
        <DocumentActionCell
          record={record}
          startIngestionPending={startIngestionPending}
          startingDocumentId={startingDocumentId}
          deletePending={deletePending}
          deletingDocumentId={deletingDocumentId}
          onStartIngestion={onStartIngestion}
          onDeleteDocument={onDeleteDocument}
        />
      ),
    },
  ];

  return (
    <Table<DocumentRecord>
      rowKey="id"
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      pagination={{ pageSize: 8, showSizeChanger: false }}
      rowClassName={(record) => (record.id === highlightedDocumentId ? styles.highlightRow : "")}
    />
  );
}
