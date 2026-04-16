import { Space, Typography } from "antd";
import { DocumentTable } from "../../components/document/DocumentTable";
import { DocumentUploadPanel } from "../../components/document/DocumentUploadPanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import type { DocumentRecord } from "../../types/document";
import styles from "./DocumentsPage.module.css";

const mockDocuments: DocumentRecord[] = [
  {
    id: "d-1",
    filename: "产品需求说明_v2.1.pdf",
    fileType: "PDF",
    sizeLabel: "2.8 MB",
    status: "ready",
    createdAt: "2026-04-15 16:22",
  },
  {
    id: "d-2",
    filename: "法务合同审阅清单.docx",
    fileType: "DOCX",
    sizeLabel: "680 KB",
    status: "processing",
    createdAt: "2026-04-16 09:15",
  },
  {
    id: "d-3",
    filename: "部署流程说明.txt",
    fileType: "TXT",
    sizeLabel: "42 KB",
    status: "queued",
    createdAt: "2026-04-16 09:18",
  },
];

export function DocumentsPage() {
  return (
    <Space direction="vertical" size={16} className={styles.pageStack}>
      <Typography.Title level={4} className={styles.pageTitle}>
        文档中心
      </Typography.Title>

      <PageSectionCard title="上传文档">
        <DocumentUploadPanel />
      </PageSectionCard>

      <PageSectionCard title="文档列表">
        <DocumentTable dataSource={mockDocuments} />
      </PageSectionCard>
    </Space>
  );
}
