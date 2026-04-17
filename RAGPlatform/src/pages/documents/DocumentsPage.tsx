import type { AxiosError } from "axios";
import { Alert, Typography, message } from "antd";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DocumentTable } from "../../components/document/DocumentTable";
import { DocumentLocationBanner } from "../../components/document/DocumentLocationBanner";
import { DocumentUploadPanel } from "../../components/document/DocumentUploadPanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { useDeleteDocument } from "../../hooks/document/useDeleteDocument";
import { useDocumentList } from "../../hooks/document/useDocumentList";
import { useStartIngestion } from "../../hooks/document/useStartIngestion";
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
  const startIngestionMutation = useStartIngestion();
  const deleteDocumentMutation = useDeleteDocument();

  const locationQuery = useMemo(
    () => readDocumentLocationQuery(searchParams),
    [searchParams],
  );
  const matchedDocument = useMemo(
    () =>
      documentListQuery.data?.find(
        (item) => item.id === locationQuery.documentId,
      ),
    [documentListQuery.data, locationQuery.documentId],
  );

  const handleStartIngestion = (documentId: string) => {
    startIngestionMutation.mutate(documentId, {
      onSuccess: () => {
        message.success("已触发入库，文档状态将自动刷新。");
      },
      onError: (error) => {
        message.error(getErrorMessage(error));
      },
    });
  };

  const handleDeleteDocument = (documentId: string) => {
    deleteDocumentMutation.mutate(documentId, {
      onSuccess: () => {
        message.success("文档已删除。");
      },
      onError: (error) => {
        message.error(getErrorMessage(error));
      },
    });
  };

  return (
    <div className={styles.pageStack}>
      <Typography.Title level={4} className={styles.pageTitle}>
        文档中心
      </Typography.Title>

      <DocumentLocationBanner
        locationQuery={locationQuery}
        matchedDocument={matchedDocument}
      />

      <PageSectionCard title="上传文档">
        <DocumentUploadPanel />
      </PageSectionCard>

      <PageSectionCard title="文档列表">
        {documentListQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title={getErrorMessage(documentListQuery.error)}
          />
        ) : null}

        <DocumentTable
          dataSource={documentListQuery.data ?? []}
          highlightedDocumentId={matchedDocument?.id}
          loading={documentListQuery.isLoading}
          startIngestionPending={startIngestionMutation.isPending}
          startingDocumentId={startIngestionMutation.variables}
          deletePending={deleteDocumentMutation.isPending}
          deletingDocumentId={deleteDocumentMutation.variables}
          onStartIngestion={handleStartIngestion}
          onDeleteDocument={handleDeleteDocument}
        />
      </PageSectionCard>
    </div>
  );
}
