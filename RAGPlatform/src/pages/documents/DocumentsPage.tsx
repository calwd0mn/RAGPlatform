import type { AxiosError } from "axios";
import { Alert, Space, Typography } from "antd";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DocumentTable } from "../../components/document/DocumentTable";
import { DocumentLocationBanner } from "../../components/document/DocumentLocationBanner";
import { DocumentUploadPanel } from "../../components/document/DocumentUploadPanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { useDocumentList } from "../../hooks/document/useDocumentList";
import type { ApiErrorPayload } from "../../types/api";
import { readDocumentLocationQuery } from "../../utils/document-location";
import styles from "./DocumentsPage.module.css";

function getErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "文档列表加载失败，请稍后重试。";
  }
  const { message } = error.response.data;
  return Array.isArray(message) ? message.join("；") : message;
}

export function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const documentListQuery = useDocumentList();

  const locationQuery = useMemo(
    () => readDocumentLocationQuery(searchParams),
    [searchParams],
  );
  const matchedDocument = useMemo(
    () =>
      documentListQuery.data?.find((item) => item.id === locationQuery.documentId),
    [documentListQuery.data, locationQuery.documentId],
  );

  return (
    <Space orientation="vertical" size={16} className={styles.pageStack}>
      <Typography.Title level={4} className={styles.pageTitle}>
        文档中心
      </Typography.Title>

      <DocumentLocationBanner locationQuery={locationQuery} matchedDocument={matchedDocument} />

      <PageSectionCard title="上传文档">
        <DocumentUploadPanel />
      </PageSectionCard>

      <PageSectionCard title="文档列表">
        {documentListQuery.isError ? (
          <Alert type="error" showIcon title={getErrorMessage(documentListQuery.error)} />
        ) : null}

        <DocumentTable
          dataSource={documentListQuery.data ?? []}
          highlightedDocumentId={matchedDocument?.id}
          loading={documentListQuery.isLoading}
        />
      </PageSectionCard>
    </Space>
  );
}
