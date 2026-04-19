import type { AxiosError } from "axios";
import { Alert, Button, Input, Popconfirm, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DocumentTable } from "../../components/document/DocumentTable";
import { DocumentLocationBanner } from "../../components/document/DocumentLocationBanner";
import { DocumentUploadPanel } from "../../components/document/DocumentUploadPanel";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { queryKeys } from "../../constants/queryKeys";
import { useDeleteDocument } from "../../hooks/document/useDeleteDocument";
import { useDocumentList } from "../../hooks/document/useDocumentList";
import { useStartIngestion } from "../../hooks/document/useStartIngestion";
import { useKnowledgeBaseList } from "../../hooks/knowledge-base/useKnowledgeBaseList";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  updateKnowledgeBase,
} from "../../services/knowledge-bases";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import type { KnowledgeBaseRecord } from "../../types/knowledge-base";
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
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState("");
  const documentListQuery = useDocumentList();
  const knowledgeBaseListQuery = useKnowledgeBaseList();
  const startIngestionMutation = useStartIngestion();
  const deleteDocumentMutation = useDeleteDocument();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const setCurrentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.setCurrentKnowledgeBaseId,
  );

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
  const knowledgeBaseColumns: ColumnsType<KnowledgeBaseRecord> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "默认",
      key: "isDefault",
      width: 80,
      render: (_, record) => (record.isDefault ? "是" : "-"),
    },
    {
      title: "激活策略",
      key: "strategy",
      render: (_, record) =>
        record.activeChunkStrategyName
          ? `${record.activeChunkStrategyName}${record.activeChunkStrategyVersion ? ` @ ${record.activeChunkStrategyVersion}` : ""}`
          : "-",
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type={record.id === currentKnowledgeBaseId ? "primary" : "default"}
            onClick={() => setCurrentKnowledgeBaseId(record.id)}
          >
            使用
          </Button>
          <Button
            size="small"
            onClick={() => {
              const nextName = window.prompt("输入新的知识库名称", record.name);
              if (!nextName || nextName.trim().length === 0) {
                return;
              }
              void renameKnowledgeBaseMutation.mutateAsync({
                knowledgeBaseId: record.id,
                name: nextName.trim(),
              });
            }}
          >
            重命名
          </Button>
          {!record.isDefault ? (
            <Popconfirm
              title="确认删除该知识库？空知识库才允许删除。"
              onConfirm={() =>
                deleteKnowledgeBaseMutation.mutateAsync(record.id)
              }
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const refreshKnowledgeBaseQueries = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBases.list }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.list(currentKnowledgeBaseId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(currentKnowledgeBaseId),
      }),
    ]);
  };

  const createKnowledgeBaseMutation = useMutation({
    mutationFn: createKnowledgeBase,
    onSuccess: async (record) => {
      setCurrentKnowledgeBaseId(record.id);
      setNewKnowledgeBaseName("");
      await refreshKnowledgeBaseQueries();
      message.success("知识库已创建。");
    },
    onError: (error: AxiosError<ApiErrorPayload>) => {
      message.error(getErrorMessage(error));
    },
  });

  const renameKnowledgeBaseMutation = useMutation({
    mutationFn: (input: { knowledgeBaseId: string; name: string }) =>
      updateKnowledgeBase(input.knowledgeBaseId, input.name),
    onSuccess: async () => {
      await refreshKnowledgeBaseQueries();
      message.success("知识库已重命名。");
    },
    onError: (error: AxiosError<ApiErrorPayload>) => {
      message.error(getErrorMessage(error));
    },
  });

  const deleteKnowledgeBaseMutation = useMutation({
    mutationFn: deleteKnowledgeBase,
    onSuccess: async () => {
      const nextKnowledgeBase =
        knowledgeBaseListQuery.data?.find((item) => item.isDefault) ??
        knowledgeBaseListQuery.data?.[0];
      if (nextKnowledgeBase) {
        setCurrentKnowledgeBaseId(nextKnowledgeBase.id);
      }
      await refreshKnowledgeBaseQueries();
      message.success("知识库已删除。");
    },
    onError: (error: AxiosError<ApiErrorPayload>) => {
      message.error(getErrorMessage(error));
    },
  });

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

      <PageSectionCard title="知识库管理">
        <Space direction="vertical" size={12} className={styles.pageStack}>
          <Space>
            <Input
              placeholder="新知识库名称"
              value={newKnowledgeBaseName}
              onChange={(event) => setNewKnowledgeBaseName(event.target.value)}
            />
            <Button
              type="primary"
              onClick={() => {
                if (newKnowledgeBaseName.trim().length === 0) {
                  message.info("请输入知识库名称。");
                  return;
                }
                void createKnowledgeBaseMutation.mutateAsync(newKnowledgeBaseName.trim());
              }}
              loading={createKnowledgeBaseMutation.isPending}
            >
              新建知识库
            </Button>
          </Space>
          <Table<KnowledgeBaseRecord>
            rowKey="id"
            size="small"
            pagination={false}
            columns={knowledgeBaseColumns}
            dataSource={knowledgeBaseListQuery.data ?? []}
            loading={knowledgeBaseListQuery.isLoading || knowledgeBaseListQuery.isFetching}
          />
        </Space>
      </PageSectionCard>

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
