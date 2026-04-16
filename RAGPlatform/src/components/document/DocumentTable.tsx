import { Button, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DocumentRecord, DocumentStatus } from "../../types/document";
import styles from "./DocumentTable.module.css";

const statusColorMap: Record<DocumentStatus, string> = {
  uploaded: "default",
  parsing: "processing",
  parsed: "cyan",
  chunked: "blue",
  embedded: "geekblue",
  queued: "default",
  processing: "processing",
  ready: "success",
  failed: "error",
};

const statusLabelMap: Record<DocumentStatus, string> = {
  uploaded: "已上传",
  parsing: "解析中",
  parsed: "已解析",
  chunked: "已切片",
  embedded: "向量化中",
  queued: "排队中",
  processing: "处理中",
  ready: "可用",
  failed: "失败",
};

interface DocumentTableProps {
  dataSource: DocumentRecord[];
  highlightedDocumentId?: string;
  loading?: boolean;
}

export function DocumentTable({
  dataSource,
  highlightedDocumentId,
  loading = false,
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
      render: (status: DocumentStatus) => (
        <Tag color={statusColorMap[status]}>{statusLabelMap[status]}</Tag>
      ),
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
      width: 180,
      render: () => (
        <Space size={8}>
          <Button type="link" size="small">
            详情
          </Button>
          <Button type="link" danger size="small">
            删除
          </Button>
        </Space>
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
