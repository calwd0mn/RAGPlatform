import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { useKnowledgeBaseList } from "../../hooks/knowledge-base/useKnowledgeBaseList";
import {
  debugRetrieve,
  getChunksDebug,
  getCurrentPrompt,
  getRagRuns,
  renderPrompt,
} from "../../services/debug";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type {
  ChunksDebugItem,
  ChunksDebugResponse,
  RagDebugHit,
  RagPromptRenderResponse,
  RagRetrieveDebugResponse,
  RagRunListResponse,
  RagRunRecord,
} from "../../types/debug";
import styles from "./DebugWorkbenchPage.module.css";
import { formatDateTime, parseErrorMessage } from "./debugShared";
import type { ChunkFormValues } from "./debugShared";

interface DebugFormValues {
  query: string;
  topK: number;
  mode: "retrieve-only" | "prompt-render";
}

interface DebugResultState {
  retrieve: RagRetrieveDebugResponse;
  prompt?: RagPromptRenderResponse;
}

const HIT_COLUMNS: ColumnsType<RagDebugHit> = [
  {
    title: "文档",
    dataIndex: "documentName",
    key: "documentName",
    ellipsis: true,
  },
  {
    title: "页码",
    dataIndex: "page",
    key: "page",
    width: 80,
    render: (value: number | undefined) => value ?? "-",
  },
  {
    title: "Chunk",
    dataIndex: "chunkIndex",
    key: "chunkIndex",
    width: 90,
    render: (value: number | undefined) => value ?? "-",
  },
  {
    title: "分数",
    dataIndex: "score",
    key: "score",
    width: 90,
    render: (value: number | undefined) =>
      typeof value === "number" ? value.toFixed(4) : "-",
  },
  {
    title: "内容预览",
    dataIndex: "contentPreview",
    key: "contentPreview",
    ellipsis: true,
  },
];

const CHUNK_COLUMNS: ColumnsType<ChunksDebugItem> = [
  {
    title: "来源",
    dataIndex: "retrievalSource",
    key: "retrievalSource",
    width: 110,
    render: (value: ChunksDebugItem["retrievalSource"]) => (
      <Tag color={value === "experiment" ? "purple" : "default"}>{value}</Tag>
    ),
  },
  {
    title: "文档",
    dataIndex: "documentName",
    key: "documentName",
    ellipsis: true,
  },
  {
    title: "页码",
    dataIndex: "page",
    key: "page",
    width: 80,
    render: (value: number | undefined) => value ?? "-",
  },
  { title: "序号", dataIndex: "order", key: "order", width: 80 },
  {
    title: "分数",
    dataIndex: "score",
    key: "score",
    width: 90,
    render: (value: number | undefined) =>
      typeof value === "number" ? value.toFixed(4) : "-",
  },
  {
    title: "内容预览",
    dataIndex: "contentPreview",
    key: "contentPreview",
    ellipsis: true,
  },
];

const RUN_COLUMNS: ColumnsType<RagRunRecord> = [
  {
    title: "时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 176,
    render: (value: string) => formatDateTime(value),
  },
  {
    title: "类型",
    dataIndex: "runType",
    key: "runType",
    width: 120,
    render: (value: RagRunRecord["runType"]) => <Tag color="blue">{value}</Tag>,
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 96,
    render: (value: RagRunRecord["status"]) => (
      <Tag color={value === "success" ? "success" : "error"}>{value}</Tag>
    ),
  },
  {
    title: "Query",
    dataIndex: "query",
    key: "query",
    ellipsis: true,
  },
];

function buildInitialDebugForm(): DebugFormValues {
  return {
    query: "请总结当前文档的核心结论",
    topK: 5,
    mode: "retrieve-only",
  };
}

function buildInitialChunkForm(): ChunkFormValues {
  return {
    limit: 20,
    offset: 0,
  };
}

export function DebugResultPage() {
  const [debugForm] = Form.useForm<DebugFormValues>();
  const [chunkForm] = Form.useForm<ChunkFormValues>();
  const [debugResult, setDebugResult] = useState<DebugResultState | null>(null);
  const [chunkResult, setChunkResult] = useState<ChunksDebugResponse | null>(
    null,
  );
  const navigate = useNavigate();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  const knowledgeBaseListQuery = useKnowledgeBaseList();

  const currentPromptQuery = useQuery({
    queryKey: ["debug", "prompt", "current"],
    queryFn: getCurrentPrompt,
  });

  const ragRunsQuery = useQuery<RagRunListResponse, Error>({
    queryKey: ["debug", "runs", currentKnowledgeBaseId],
    queryFn: () =>
      getRagRuns({
        knowledgeBaseId: currentKnowledgeBaseId,
        limit: 30,
        offset: 0,
      }),
    enabled: currentKnowledgeBaseId.length > 0,
  });

  const activeKnowledgeBase = useMemo(
    () =>
      knowledgeBaseListQuery.data?.find(
        (item) => item.id === currentKnowledgeBaseId,
      ),
    [currentKnowledgeBaseId, knowledgeBaseListQuery.data],
  );

  const runDebugMutation = useMutation({
    mutationFn: async (values: DebugFormValues): Promise<DebugResultState> => {
      const retrieve = await debugRetrieve({
        knowledgeBaseId: currentKnowledgeBaseId,
        query: values.query.trim(),
        topK: values.topK,
      });

      if (values.mode === "retrieve-only") {
        return { retrieve };
      }

      const prompt = await renderPrompt({
        knowledgeBaseId: currentKnowledgeBaseId,
        query: values.query.trim(),
        topK: values.topK,
      });

      return { retrieve, prompt };
    },
    onSuccess: (result) => {
      setDebugResult(result);
      void ragRunsQuery.refetch();
      message.success("调试完成。");
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const chunkDebugMutation = useMutation({
    mutationFn: getChunksDebug,
    onSuccess: (response) => {
      setChunkResult(response);
      message.success("Chunk 数据已更新。");
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const handleRunDebug = async (): Promise<void> => {
    if (currentKnowledgeBaseId.length === 0) {
      message.warning("请先选择知识库。");
      return;
    }

    try {
      const values = await debugForm.validateFields();
      await runDebugMutation.mutateAsync(values);
    } catch (error) {
      if (error instanceof Error) {
        message.error(parseErrorMessage(error));
      }
    }
  };

  const handleChunkSearch = async (): Promise<void> => {
    if (currentKnowledgeBaseId.length === 0) {
      message.warning("请先选择知识库。");
      return;
    }

    try {
      const values = await chunkForm.validateFields();
      await chunkDebugMutation.mutateAsync({
        knowledgeBaseId: currentKnowledgeBaseId,
        keyword: values.keyword?.trim() || undefined,
        query: values.query?.trim() || undefined,
        page: values.page,
        limit: values.limit,
        offset: values.offset,
      });
    } catch (error) {
      if (error instanceof Error) {
        message.error(parseErrorMessage(error));
      }
    }
  };

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <Typography.Title level={4} className={styles.pageTitle}>
            RAG 调试
          </Typography.Title>
          <Typography.Paragraph type="secondary" className={styles.pageIntro}>
            基于当前知识库已入库 chunks 快速调试检索和 Prompt，不重新切分文档，不重新生成实验 chunks。
          </Typography.Paragraph>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryStat}>
            <Typography.Text type="secondary">当前知识库</Typography.Text>
            <Typography.Text strong>
              {activeKnowledgeBase?.name ?? "未选择"}
            </Typography.Text>
          </div>
          <div className={styles.summaryStat}>
            <Typography.Text type="secondary">当前 Chunk 策略</Typography.Text>
            <Typography.Text strong>
              {activeKnowledgeBase?.activeChunkStrategyName ?? "默认策略"}
            </Typography.Text>
          </div>
          <div className={styles.summaryStat}>
            <Typography.Text type="secondary">Chunk Size / Overlap</Typography.Text>
            <Typography.Text strong>
              {activeKnowledgeBase?.activeChunkSize ?? "-"} /{" "}
              {activeKnowledgeBase?.activeChunkOverlap ?? "-"}
            </Typography.Text>
          </div>
          <div className={styles.summaryStat}>
            <Typography.Text type="secondary">当前 Prompt</Typography.Text>
            <Typography.Text strong>
              {currentPromptQuery.data?.versionedId ?? "加载中"}
            </Typography.Text>
          </div>
        </div>
      </header>

      <PageSectionCard
        title="快速调试"
        extra={<Button onClick={() => navigate("/app/debug")}>策略设置</Button>}
      >
        <Form<DebugFormValues>
          form={debugForm}
          layout="vertical"
          initialValues={buildInitialDebugForm()}
        >
          <Row gutter={[12, 0]} align="bottom">
            <Col xs={24} lg={12}>
              <Form.Item
                label="Query"
                name="query"
                rules={[{ required: true, message: "请输入 query" }]}
              >
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  placeholder="输入要调试的问题"
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Form.Item
                label="TopK"
                name="topK"
                rules={[{ required: true, message: "请输入 TopK" }]}
              >
                <InputNumber min={1} max={20} className={styles.numberInput} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} lg={5}>
              <Form.Item label="模式" name="mode">
                <Select
                  options={[
                    { label: "仅检索", value: "retrieve-only" },
                    { label: "检索 + Prompt 渲染", value: "prompt-render" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={4}>
              <Button
                type="primary"
                block
                loading={runDebugMutation.isPending}
                onClick={() => {
                  void handleRunDebug();
                }}
              >
                运行调试
              </Button>
            </Col>
          </Row>
        </Form>
      </PageSectionCard>

      <Tabs
        className={styles.debugTabs}
        items={[
          {
            key: "result",
            label: "调试结果",
            children: (
              <div className={styles.resultGrid}>
                <PageSectionCard title="检索命中">
                  {!debugResult ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="尚未运行调试"
                    />
                  ) : (
                    <Space direction="vertical" className={styles.fullWidth} size={12}>
                      <div className={styles.tagRow}>
                        <Tag color="blue">
                          Provider {debugResult.retrieve.retrievalProvider}
                        </Tag>
                        <Tag>Prompt {debugResult.retrieve.promptVersion}</Tag>
                        <Tag>TopK {debugResult.retrieve.topK}</Tag>
                        <Tag>命中 {debugResult.retrieve.retrievedCount}</Tag>
                        <Tag>{debugResult.retrieve.latencyMs}ms</Tag>
                      </div>
                      <Table<RagDebugHit>
                        rowKey="chunkId"
                        columns={HIT_COLUMNS}
                        dataSource={debugResult.retrieve.retrievalHits}
                        pagination={false}
                        size="small"
                        scroll={{ x: 960 }}
                      />
                    </Space>
                  )}
                </PageSectionCard>

                <PageSectionCard title="Prompt 渲染">
                  {!debugResult?.prompt ? (
                    <Alert
                      type="info"
                      showIcon
                      message="选择“检索 + Prompt 渲染”模式后可查看最终 Prompt。"
                    />
                  ) : (
                    <Space direction="vertical" className={styles.fullWidth} size={12}>
                      <div className={styles.sectionSubgrid}>
                        <div className={styles.snapshotItem}>
                          <Typography.Text type="secondary">Context 长度</Typography.Text>
                          <Typography.Text strong>
                            {debugResult.prompt.promptInput.context.length}
                          </Typography.Text>
                        </div>
                        <div className={styles.snapshotItem}>
                          <Typography.Text type="secondary">消息数</Typography.Text>
                          <Typography.Text strong>
                            {debugResult.prompt.promptOutput.messages.length}
                          </Typography.Text>
                        </div>
                      </div>
                      <pre className={styles.jsonCode}>
                        {debugResult.prompt.promptOutput.promptText}
                      </pre>
                    </Space>
                  )}
                </PageSectionCard>
              </div>
            ),
          },
          {
            key: "chunks",
            label: "Chunk 浏览",
            children: (
              <PageSectionCard title="Chunk 浏览">
                <Form<ChunkFormValues>
                  form={chunkForm}
                  layout="vertical"
                  initialValues={buildInitialChunkForm()}
                >
                  <div className={styles.inlineFilterGrid}>
                    <Form.Item label="关键词" name="keyword">
                      <Input placeholder="关键字过滤 content" />
                    </Form.Item>
                    <Form.Item label="语义 Query" name="query">
                      <Input placeholder="用于 score 调试" />
                    </Form.Item>
                    <Form.Item label="Page" name="page">
                      <InputNumber min={1} className={styles.numberInput} />
                    </Form.Item>
                    <Form.Item label="Limit" name="limit">
                      <InputNumber
                        min={1}
                        max={100}
                        className={styles.numberInput}
                      />
                    </Form.Item>
                    <Form.Item label="Offset" name="offset">
                      <InputNumber
                        min={0}
                        max={1000}
                        className={styles.numberInput}
                      />
                    </Form.Item>
                  </div>
                </Form>
                <Button
                  type="primary"
                  loading={chunkDebugMutation.isPending}
                  onClick={() => {
                    void handleChunkSearch();
                  }}
                >
                  查询 Chunks
                </Button>
                {!chunkResult ? (
                  <Alert type="info" showIcon message="尚未查询 chunk 数据" />
                ) : (
                  <Table<ChunksDebugItem>
                    rowKey="chunkId"
                    size="small"
                    columns={CHUNK_COLUMNS}
                    dataSource={chunkResult.items}
                    pagination={false}
                    scroll={{ x: 960, y: 360 }}
                  />
                )}
              </PageSectionCard>
            ),
          },
          {
            key: "history",
            label: "运行历史",
            children: (
              <PageSectionCard title="运行历史">
                {ragRunsQuery.isError ? (
                  <Alert
                    type="error"
                    showIcon
                    message="读取运行历史失败"
                    description={parseErrorMessage(ragRunsQuery.error)}
                  />
                ) : (
                  <Table<RagRunRecord>
                    rowKey="runId"
                    columns={RUN_COLUMNS}
                    dataSource={ragRunsQuery.data?.items ?? []}
                    size="small"
                    pagination={false}
                    loading={ragRunsQuery.isLoading || ragRunsQuery.isFetching}
                    scroll={{ x: 880, y: 360 }}
                  />
                )}
              </PageSectionCard>
            ),
          },
        ]}
      />
    </div>
  );
}
