import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tabs,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { useKnowledgeBaseList } from "../../hooks/knowledge-base/useKnowledgeBaseList";
import {
  createDebugExperiment,
  getChunksDebug,
  getCurrentPrompt,
  getDebugExperiments,
  getRagRuns,
  publishDebugExperiment,
  runDebugExperiment,
  updateDebugExperiment,
} from "../../services/debug";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type {
  ChunkStrategyDraft,
  ChunksDebugItem,
  ChunksDebugQuery,
  ChunksDebugResponse,
  DebugExperimentCreateRequest,
  DebugExperimentRecord,
  DebugExperimentRunResult,
  DebugExperimentUpdateRequest,
  PromptDraft,
  RagPromptCurrentResponse,
  RagRunListResponse,
  RagRunRecord,
} from "../../types/debug";
import styles from "./DebugWorkbenchPage.module.css";

interface ExperimentStrategyFormValue {
  name: string;
  type: "recursive" | "markdown" | "token";
  chunkSize: number;
  chunkOverlap: number;
  preserveSentenceBoundary: boolean;
  separatorsText?: string;
  maxSentenceMerge?: number;
  versionLabel?: string;
}

interface ExperimentFormValues {
  queriesText: string;
  topK: number;
  mode: "retrieve-only" | "full-rag";
  basePromptId: string;
  promptVersionLabel?: string;
  systemPrompt: string;
  contextTemplate: string;
  chunkStrategyDrafts: ExperimentStrategyFormValue[];
}

interface ChunkFormValues {
  experimentId?: string;
  strategyName?: string;
  keyword?: string;
  query?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

const EXPERIMENT_COLUMNS: ColumnsType<DebugExperimentRecord> = [
  {
    title: "时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 180,
    render: (value: string) =>
      new Date(value).toLocaleString("zh-CN", { hour12: false }),
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 110,
    render: (value: DebugExperimentRecord["status"]) => {
      const colorMap: Record<DebugExperimentRecord["status"], string> = {
        draft: "default",
        running: "processing",
        completed: "success",
        failed: "error",
        published: "gold",
      };
      return <Tag color={colorMap[value]}>{value}</Tag>;
    },
  },
  {
    title: "模式",
    dataIndex: "mode",
    key: "mode",
    width: 120,
  },
  {
    title: "Queries",
    key: "queries",
    render: (_, record) => record.queries.length,
    width: 90,
  },
  {
    title: "策略",
    key: "strategies",
    render: (_, record) => record.chunkStrategyDrafts.length,
    width: 90,
  },
  {
    title: "Namespace",
    dataIndex: "chunkNamespace",
    key: "chunkNamespace",
    ellipsis: true,
  },
];

const RUN_COLUMNS: ColumnsType<RagRunRecord> = [
  {
    title: "时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 180,
    render: (value: string) =>
      new Date(value).toLocaleString("zh-CN", { hour12: false }),
  },
  {
    title: "类型",
    dataIndex: "runType",
    key: "runType",
    width: 120,
    render: (value: RagRunRecord["runType"]) => <Tag color="blue">{value}</Tag>,
  },
  {
    title: "来源",
    dataIndex: "retrievalSource",
    key: "retrievalSource",
    width: 120,
    render: (value: RagRunRecord["retrievalSource"]) =>
      value ? (
        <Tag color={value === "experiment" ? "purple" : "default"}>{value}</Tag>
      ) : (
        "-"
      ),
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 100,
    render: (value: RagRunRecord["status"]) =>
      value === "success" ? (
        <Tag color="success">success</Tag>
      ) : (
        <Tag color="error">error</Tag>
      ),
  },
  {
    title: "Query",
    dataIndex: "query",
    key: "query",
    ellipsis: true,
  },
  {
    title: "Prompt",
    dataIndex: "promptVersion",
    key: "promptVersion",
    width: 150,
    ellipsis: true,
  },
  {
    title: "Namespace",
    dataIndex: "retrievalNamespace",
    key: "retrievalNamespace",
    width: 160,
    ellipsis: true,
    render: (value: string | undefined) => value ?? "production",
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
    title: "策略",
    dataIndex: "strategyName",
    key: "strategyName",
    width: 150,
    render: (value: string | undefined) => value ?? "-",
  },
  {
    title: "文档",
    dataIndex: "documentName",
    key: "documentName",
    width: 220,
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
    title: "序号",
    dataIndex: "order",
    key: "order",
    width: 80,
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

function parseErrorMessage(input: Error): string {
  const text = input.message.trim();
  return text.length > 0 ? text : "请求失败，请稍后重试。";
}

function buildPromptDraft(values: ExperimentFormValues): PromptDraft {
  return {
    basePromptId: values.basePromptId.trim(),
    systemPrompt: values.systemPrompt.trim(),
    contextTemplate: values.contextTemplate.trim(),
    versionLabel: values.promptVersionLabel?.trim() || undefined,
  };
}

function buildStrategyDrafts(
  values: ExperimentFormValues,
): ChunkStrategyDraft[] {
  return values.chunkStrategyDrafts.map(
    (item): ChunkStrategyDraft => ({
      name: item.name.trim(),
      type: item.type,
      chunkSize: item.chunkSize,
      chunkOverlap: item.chunkOverlap,
      preserveSentenceBoundary: item.preserveSentenceBoundary,
      separators: (item.separatorsText ?? "")
        .split(/\r?\n|,/)
        .map((entry): string => entry.trim())
        .filter((entry): boolean => entry.length > 0),
      maxSentenceMerge: item.maxSentenceMerge,
      versionLabel: item.versionLabel?.trim() || undefined,
    }),
  );
}

function buildExperimentPayload(
  values: ExperimentFormValues,
  knowledgeBaseId: string,
): DebugExperimentCreateRequest {
  return {
    knowledgeBaseId,
    scope: "manual",
    queries: values.queriesText
      .split(/\r?\n/)
      .map((item): string => item.trim())
      .filter((item): boolean => item.length > 0),
    promptDraft: buildPromptDraft(values),
    chunkStrategyDrafts: buildStrategyDrafts(values),
    topK: values.topK,
    mode: values.mode,
  };
}

function mapExperimentToForm(
  record: DebugExperimentRecord,
): ExperimentFormValues {
  return {
    queriesText: record.queries.join("\n"),
    topK: record.topK,
    mode: record.mode,
    basePromptId: record.promptDraft.basePromptId,
    promptVersionLabel: record.promptDraft.versionLabel,
    systemPrompt: record.promptDraft.systemPrompt,
    contextTemplate: record.promptDraft.contextTemplate,
    chunkStrategyDrafts: record.chunkStrategyDrafts.map(
      (item): ExperimentStrategyFormValue => ({
        name: item.name,
        type: item.type,
        chunkSize: item.chunkSize,
        chunkOverlap: item.chunkOverlap,
        preserveSentenceBoundary: item.preserveSentenceBoundary,
        separatorsText: item.separators.join("\n"),
        maxSentenceMerge: item.maxSentenceMerge,
        versionLabel: item.versionLabel,
      }),
    ),
  };
}

function buildInitialExperimentFormValues(
  prompt: RagPromptCurrentResponse | undefined,
): ExperimentFormValues {
  return {
    queriesText: "请总结当前文档的核心结论",
    topK: 5,
    mode: "retrieve-only",
    basePromptId: prompt?.id ?? "rag-answer",
    promptVersionLabel: "draft",
    systemPrompt: prompt?.systemPrompt ?? "",
    contextTemplate: prompt?.contextTemplate ?? "检索上下文如下：\n{context}",
    chunkStrategyDrafts: [
      {
        name: "sentence-recursive-v1",
        type: "recursive",
        chunkSize: 800,
        chunkOverlap: 150,
        preserveSentenceBoundary: true,
        separatorsText: "。\n！\n？\n；\n\n",
        versionLabel: "draft",
      },
    ],
  };
}

function buildInitialChunkFormValues(): ChunkFormValues {
  return {
    limit: 20,
    offset: 0,
  };
}

export function DebugWorkbenchPage() {
  const [experimentForm] = Form.useForm<ExperimentFormValues>();
  const [chunkForm] = Form.useForm<ChunkFormValues>();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();
  const [chunkDebugResult, setChunkDebugResult] =
    useState<ChunksDebugResponse | null>(null);
  const [lastExperimentResult, setLastExperimentResult] =
    useState<DebugExperimentRunResult | null>(null);
  const [detailTabKey, setDetailTabKey] = useState<
    "result" | "chunks" | "runs"
  >("result");
  const [runsLimit, setRunsLimit] = useState(20);
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const previousKnowledgeBaseIdRef = useRef<string>("");

  const knowledgeBaseListQuery = useKnowledgeBaseList();

  const currentPromptQuery = useQuery<RagPromptCurrentResponse, Error>({
    queryKey: ["debug", "prompt", "current"],
    queryFn: getCurrentPrompt,
  });

  const experimentsQuery = useQuery({
    queryKey: ["debug", "experiments", currentKnowledgeBaseId],
    queryFn: () =>
      getDebugExperiments({
        knowledgeBaseId: currentKnowledgeBaseId,
        limit: 30,
        offset: 0,
      }),
    enabled: currentKnowledgeBaseId.length > 0,
  });

  const ragRunsQuery = useQuery<RagRunListResponse, Error>({
    queryKey: ["debug", "runs", currentKnowledgeBaseId, runsLimit],
    queryFn: () =>
      getRagRuns({
        knowledgeBaseId: currentKnowledgeBaseId,
        limit: runsLimit,
        offset: 0,
      }),
    enabled: currentKnowledgeBaseId.length > 0,
  });

  const createExperimentMutation = useMutation({
    mutationFn: createDebugExperiment,
    onSuccess: (record) => {
      setSelectedExperimentId(record.id);
      experimentForm.setFieldsValue(mapExperimentToForm(record));
      void experimentsQuery.refetch();
      message.success("实验草稿已创建。");
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const updateExperimentMutation = useMutation({
    mutationFn: (input: {
      experimentId: string;
      payload: DebugExperimentUpdateRequest;
    }) => updateDebugExperiment(input.experimentId, input.payload),
    onSuccess: (record) => {
      experimentForm.setFieldsValue(mapExperimentToForm(record));
      void experimentsQuery.refetch();
      message.success("实验草稿已更新。");
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const runExperimentMutation = useMutation({
    mutationFn: runDebugExperiment,
    onSuccess: (result) => {
      setLastExperimentResult(result);
      void experimentsQuery.refetch();
      void ragRunsQuery.refetch();
      message.success("实验运行完成。");
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const publishExperimentMutation = useMutation({
    mutationFn: (input: { experimentId: string; strategyName?: string }) =>
      publishDebugExperiment(input.experimentId, {
        strategyName: input.strategyName,
      }),
    onSuccess: (result) => {
      void experimentsQuery.refetch();
      message.success(
        `策略 ${result.publishedStrategyName} 已发布到生产 chunks。`,
      );
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const chunksDebugMutation = useMutation<
    ChunksDebugResponse,
    Error,
    ChunksDebugQuery
  >({
    mutationFn: getChunksDebug,
    onSuccess: (response) => {
      setChunkDebugResult(response);
      message.success("Chunks 调试结果已更新。");
    },
    onError: (error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const selectedExperiment = useMemo(
    (): DebugExperimentRecord | undefined =>
      experimentsQuery.data?.items.find(
        (item) => item.id === selectedExperimentId,
      ),
    [experimentsQuery.data?.items, selectedExperimentId],
  );

  const strategyOptions = useMemo(
    () =>
      (selectedExperiment?.chunkStrategyDrafts ?? []).map((item) => ({
        label: item.name,
        value: item.name,
      })),
    [selectedExperiment],
  );

  const currentKnowledgeBaseName =
    knowledgeBaseListQuery.data?.find(
      (item) => item.id === currentKnowledgeBaseId,
    )?.name ?? "未选择";

  useEffect(() => {
    const previousKnowledgeBaseId = previousKnowledgeBaseIdRef.current;
    previousKnowledgeBaseIdRef.current = currentKnowledgeBaseId;

    if (previousKnowledgeBaseId === currentKnowledgeBaseId) {
      return;
    }

    setSelectedExperimentId(undefined);
    setChunkDebugResult(null);
    setLastExperimentResult(null);
    experimentForm.resetFields();
    experimentForm.setFieldsValue(
      buildInitialExperimentFormValues(currentPromptQuery.data),
    );
    chunkForm.resetFields();
    chunkForm.setFieldsValue(buildInitialChunkFormValues());
  }, [
    chunkForm,
    currentKnowledgeBaseId,
    currentPromptQuery.data,
    experimentForm,
  ]);

  const handleCreateExperiment = async (): Promise<void> => {
    if (currentKnowledgeBaseId.length === 0) {
      message.warning("请先选择知识库。");
      return;
    }

    const values = await experimentForm.validateFields();
    await createExperimentMutation.mutateAsync(
      buildExperimentPayload(values, currentKnowledgeBaseId),
    );
  };

  const handleUpdateExperiment = async (): Promise<void> => {
    if (!selectedExperimentId) {
      message.warning("请先从右侧列表选择一个实验，或先创建实验。");
      return;
    }

    if (!selectedExperiment) {
      message.warning("当前实验不存在或不属于已选知识库，请重新选择。");
      return;
    }

    const values = await experimentForm.validateFields();
    await updateExperimentMutation.mutateAsync({
      experimentId: selectedExperimentId,
      payload: {
        ...buildExperimentPayload(values, selectedExperiment.knowledgeBaseId),
        knowledgeBaseId: selectedExperiment.knowledgeBaseId,
      },
    });
  };

  const handleRunExperiment = async (): Promise<void> => {
    if (!selectedExperimentId) {
      message.warning("请先创建或选择实验。");
      return;
    }

    await runExperimentMutation.mutateAsync(selectedExperimentId);
  };

  const handlePublishExperiment = async (): Promise<void> => {
    if (!selectedExperimentId) {
      message.warning("请先创建或选择实验。");
      return;
    }

    const values = experimentForm.getFieldsValue();
    const firstStrategyName = values.chunkStrategyDrafts?.[0]?.name?.trim();
    await publishExperimentMutation.mutateAsync({
      experimentId: selectedExperimentId,
      strategyName:
        firstStrategyName && firstStrategyName.length > 0
          ? firstStrategyName
          : undefined,
    });
  };

  const handleChunkSearch = async (): Promise<void> => {
    const values = await chunkForm.validateFields();
    await chunksDebugMutation.mutateAsync({
      knowledgeBaseId: currentKnowledgeBaseId,
      experimentId: values.experimentId,
      strategyName: values.strategyName?.trim() || undefined,
      keyword: values.keyword?.trim() || undefined,
      query: values.query?.trim() || undefined,
      page: values.page,
      limit: values.limit,
      offset: values.offset,
    });
  };

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <div>
          <Typography.Title level={4} className={styles.pageTitle}>
            联动式 RAG 调试实验
          </Typography.Title>
          <Typography.Text type="secondary">
            调试入口已切换为实验模型：同一次实验可联动调整 Prompt、Chunk
            策略、TopK 与查询集，运行结果统一落库。
          </Typography.Text>
        </div>

        <div className={styles.heroStats} aria-live="polite">
          <div className={styles.heroStat}>
            <Typography.Text type="secondary">当前知识库</Typography.Text>
            <Typography.Text strong>{currentKnowledgeBaseName}</Typography.Text>
          </div>
          <div className={styles.heroStat}>
            <Typography.Text type="secondary">Prompt 版本</Typography.Text>
            <Typography.Text strong>
              {currentPromptQuery.data?.versionedId ?? "加载中"}
            </Typography.Text>
          </div>
          <div className={styles.heroStat}>
            <Typography.Text type="secondary">实验数量</Typography.Text>
            <Typography.Text strong>
              {experimentsQuery.data?.items.length ?? 0}
            </Typography.Text>
          </div>
          <div className={styles.heroStat}>
            <Typography.Text type="secondary">调试运行记录</Typography.Text>
            <Typography.Text strong>
              {ragRunsQuery.data?.items.length ?? 0}
            </Typography.Text>
          </div>
        </div>
      </header>

      {currentPromptQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="读取当前 Prompt 失败"
          description={parseErrorMessage(currentPromptQuery.error)}
        />
      ) : null}

      <div className={styles.workspaceGrid}>
        <div className={styles.primaryColumn}>
          <PageSectionCard title="实验配置" className={styles.flexCard}>
            <div className={styles.configCardShell}>
              <div className={styles.configScrollArea}>
                <Space
                  direction="vertical"
                  className={styles.fullWidth}
                  size={12}
                >
                  <div className={styles.summaryPanel}>
                    <div className={styles.summaryHeader}>
                      <div>
                        <Typography.Text strong>
                          当前正式 Prompt
                        </Typography.Text>
                        <Typography.Paragraph
                          type="secondary"
                          className={styles.summaryDescription}
                        >
                          当前表单默认基于线上 Prompt
                          初始化，可在实验内继续覆盖并保存草稿。
                        </Typography.Paragraph>
                      </div>
                      <div className={styles.tagRow}>
                        <Tag color="geekblue">
                          知识库 {currentKnowledgeBaseName}
                        </Tag>
                        <Tag color="blue">
                          {currentPromptQuery.data?.versionedId ?? "加载中"}
                        </Tag>
                        <Tag>ID: {currentPromptQuery.data?.id ?? "-"}</Tag>
                        <Tag>
                          Version: {currentPromptQuery.data?.version ?? "-"}
                        </Tag>
                      </div>
                    </div>
                  </div>

                  <Form<ExperimentFormValues>
                    layout="vertical"
                    form={experimentForm}
                    initialValues={buildInitialExperimentFormValues(
                      currentPromptQuery.data,
                    )}
                    className={styles.formStack}
                  >
                    <Alert
                      type="info"
                      showIcon
                      message="实验范围固定为当前知识库"
                      description="Prompt 调试、Chunk 调试和联动调试都会默认覆盖当前知识库下全部 ready 文档，不再按单文档选择。"
                    />

                    <div className={styles.formSection}>
                      <div className={styles.sectionHeading}>
                        <Typography.Text strong>实验参数</Typography.Text>
                        <Typography.Text type="secondary">
                          先确定检索模式、TopK 和查询集，再决定是否覆盖 Prompt
                          与切块策略。
                        </Typography.Text>
                      </div>

                      <Row gutter={[12, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="TopK"
                            name="topK"
                            rules={[{ required: true, message: "请输入 TopK" }]}
                          >
                            <InputNumber
                              min={1}
                              max={20}
                              className={styles.numberInput}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="模式" name="mode">
                            <Select
                              options={[
                                {
                                  label: "retrieve-only",
                                  value: "retrieve-only",
                                },
                                { label: "full-rag", value: "full-rag" },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="Queries（每行一条）"
                        name="queriesText"
                        rules={[
                          { required: true, message: "请输入至少一条 query" },
                        ]}
                      >
                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
                      </Form.Item>
                    </div>

                    <div className={styles.formSection}>
                      <div className={styles.sectionHeading}>
                        <Typography.Text strong>Prompt 草稿</Typography.Text>
                        <Typography.Text type="secondary">
                          这里定义同一批实验查询使用的 Prompt 版本标签、System
                          Prompt 与上下文模板。
                        </Typography.Text>
                      </div>

                      <Row gutter={[12, 0]}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="Base Prompt ID"
                            name="basePromptId"
                            rules={[
                              { required: true, message: "请输入 Prompt ID" },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="Prompt Version Label"
                            name="promptVersionLabel"
                          >
                            <Input placeholder="draft / v2 / exp-a" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="System Prompt"
                        name="systemPrompt"
                        rules={[
                          { required: true, message: "请输入 system prompt" },
                        ]}
                      >
                        <Input.TextArea
                          autoSize={{ minRows: 6, maxRows: 14 }}
                        />
                      </Form.Item>

                      <Form.Item
                        label="Context Template"
                        name="contextTemplate"
                        rules={[
                          { required: true, message: "请输入上下文模板" },
                        ]}
                      >
                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
                      </Form.Item>
                    </div>

                    <Form.List name="chunkStrategyDrafts">
                      {(fields, { add, remove }) => (
                        <div className={styles.formSection}>
                          <div className={styles.sectionBar}>
                            <div className={styles.sectionHeading}>
                              <Typography.Text strong>
                                Chunk 策略草稿
                              </Typography.Text>
                              <Typography.Text type="secondary">
                                多策略并排保留，方便比较不同切块方案的命中结果与发布版本。
                              </Typography.Text>
                            </div>
                            <Button
                              onClick={() =>
                                add({
                                  name: `strategy-${fields.length + 1}`,
                                  type: "recursive",
                                  chunkSize: 800,
                                  chunkOverlap: 150,
                                  preserveSentenceBoundary: true,
                                })
                              }
                            >
                              新增策略
                            </Button>
                          </div>

                          <div className={styles.strategyList}>
                            {fields.map((field) => (
                              <div
                                key={field.key}
                                className={styles.strategyCard}
                              >
                                <Row gutter={[12, 0]}>
                                  <Col xs={24} lg={8}>
                                    <Form.Item
                                      {...field}
                                      label="名称"
                                      name={[field.name, "name"]}
                                      rules={[
                                        {
                                          required: true,
                                          message: "请输入策略名称",
                                        },
                                      ]}
                                    >
                                      <Input />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} sm={12} lg={6}>
                                    <Form.Item
                                      {...field}
                                      label="类型"
                                      name={[field.name, "type"]}
                                      rules={[
                                        {
                                          required: true,
                                          message: "请选择类型",
                                        },
                                      ]}
                                    >
                                      <Select
                                        options={[
                                          {
                                            label: "recursive",
                                            value: "recursive",
                                          },
                                          {
                                            label: "markdown",
                                            value: "markdown",
                                          },
                                          { label: "token", value: "token" },
                                        ]}
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} sm={12} lg={5}>
                                    <Form.Item
                                      {...field}
                                      label="Chunk Size"
                                      name={[field.name, "chunkSize"]}
                                      rules={[
                                        {
                                          required: true,
                                          message: "请输入 chunk size",
                                        },
                                      ]}
                                    >
                                      <InputNumber
                                        min={50}
                                        max={8000}
                                        className={styles.numberInput}
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} sm={12} lg={5}>
                                    <Form.Item
                                      {...field}
                                      label="Overlap"
                                      name={[field.name, "chunkOverlap"]}
                                      rules={[
                                        {
                                          required: true,
                                          message: "请输入 overlap",
                                        },
                                      ]}
                                    >
                                      <InputNumber
                                        min={0}
                                        max={4000}
                                        className={styles.numberInput}
                                      />
                                    </Form.Item>
                                  </Col>
                                </Row>

                                <Row gutter={[12, 0]}>
                                  <Col xs={24} md={8}>
                                    <Form.Item
                                      {...field}
                                      label="Version Label"
                                      name={[field.name, "versionLabel"]}
                                    >
                                      <Input placeholder="draft / v1" />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <Form.Item
                                      {...field}
                                      label="Max Sentence Merge"
                                      name={[field.name, "maxSentenceMerge"]}
                                    >
                                      <InputNumber
                                        min={1}
                                        max={100}
                                        className={styles.numberInput}
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <Form.Item
                                      {...field}
                                      label="句子边界优先"
                                      name={[
                                        field.name,
                                        "preserveSentenceBoundary",
                                      ]}
                                      valuePropName="checked"
                                    >
                                      <Switch />
                                    </Form.Item>
                                  </Col>
                                </Row>

                                <Form.Item
                                  {...field}
                                  label="Separators（逗号或换行分隔，可选）"
                                  name={[field.name, "separatorsText"]}
                                >
                                  <Input.TextArea
                                    autoSize={{ minRows: 2, maxRows: 6 }}
                                  />
                                </Form.Item>

                                {fields.length > 1 ? (
                                  <Button
                                    danger
                                    onClick={() => remove(field.name)}
                                  >
                                    删除策略
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Form.List>
                  </Form>
                </Space>
              </div>

              <div className={styles.actionBar}>
                <Space wrap>
                  <Button
                    type="primary"
                    onClick={() => {
                      void handleCreateExperiment();
                    }}
                    loading={createExperimentMutation.isPending}
                  >
                    创建实验
                  </Button>
                  <Button
                    onClick={() => {
                      void handleUpdateExperiment();
                    }}
                    loading={updateExperimentMutation.isPending}
                  >
                    更新实验
                  </Button>
                  <Button
                    onClick={() => {
                      void handleRunExperiment();
                    }}
                    loading={runExperimentMutation.isPending}
                  >
                    运行实验
                  </Button>
                  <Popconfirm
                    title="确认发布当前实验的第一条策略到正式 chunks？"
                    onConfirm={() => {
                      void handlePublishExperiment();
                    }}
                  >
                    <Button loading={publishExperimentMutation.isPending}>
                      发布到生产
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            </div>
          </PageSectionCard>
        </div>

        <div className={styles.secondaryColumn}>
          <PageSectionCard title="实验列表" className={styles.selectionCard}>
            <div className={styles.selectionCardBody}>
              {experimentsQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  message="读取实验列表失败"
                  description={parseErrorMessage(experimentsQuery.error)}
                />
              ) : (
                <div className={styles.tableWrap}>
                  <Table<DebugExperimentRecord>
                    rowKey="id"
                    size="small"
                    columns={EXPERIMENT_COLUMNS}
                    dataSource={experimentsQuery.data?.items ?? []}
                    loading={
                      experimentsQuery.isLoading || experimentsQuery.isFetching
                    }
                    pagination={false}
                    scroll={{ x: 860, y: 280 }}
                    rowSelection={{
                      type: "radio",
                      selectedRowKeys: selectedExperimentId
                        ? [selectedExperimentId]
                        : [],
                      onChange: (selectedKeys, selectedRows) => {
                        const nextId =
                          typeof selectedKeys[0] === "string"
                            ? selectedKeys[0]
                            : undefined;
                        setSelectedExperimentId(nextId);
                        const nextRecord = selectedRows[0];
                        if (nextRecord) {
                          experimentForm.setFieldsValue(
                            mapExperimentToForm(nextRecord),
                          );
                          chunkForm.setFieldValue(
                            "experimentId",
                            nextRecord.id,
                          );
                        }
                      },
                    }}
                  />
                </div>
              )}
            </div>
          </PageSectionCard>

          <PageSectionCard title="实验详情" className={styles.detailCard}>
            <div className={styles.detailCardBody}>
              <Tabs
                activeKey={detailTabKey}
                onChange={(key) => {
                  if (key === "result" || key === "chunks" || key === "runs") {
                    setDetailTabKey(key);
                  }
                }}
                items={[
                  {
                    key: "result",
                    label: "实验运行结果",
                    children: !lastExperimentResult ? (
                      <Alert type="info" showIcon message="尚未运行实验" />
                    ) : (
                      <Space
                        direction="vertical"
                        className={styles.fullWidth}
                        size={12}
                      >
                        <div className={styles.tagRow}>
                          <Tag color="blue">
                            Experiment {lastExperimentResult.experimentId}
                          </Tag>
                          <Tag>Status {lastExperimentResult.status}</Tag>
                          <Tag>Mode {lastExperimentResult.mode}</Tag>
                          <Tag>TopK {lastExperimentResult.topK}</Tag>
                        </div>
                        <div className={styles.codePanel}>
                          <pre className={styles.jsonCode}>
                            {JSON.stringify(lastExperimentResult, null, 2)}
                          </pre>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: "chunks",
                    label: "Chunks 浏览",
                    children: (
                      <div className={styles.chunkPanel}>
                        <Form<ChunkFormValues>
                          layout="vertical"
                          form={chunkForm}
                          initialValues={buildInitialChunkFormValues()}
                          className={styles.chunkForm}
                        >
                          <Form.Item label="实验（可选）" name="experimentId">
                            <Select
                              allowClear
                              options={(experimentsQuery.data?.items ?? []).map(
                                (item) => ({
                                  label: `${item.status} · ${item.chunkNamespace}`,
                                  value: item.id,
                                }),
                              )}
                              placeholder="不选则浏览正式 chunks"
                              onChange={(value: string | undefined) => {
                                const matched =
                                  experimentsQuery.data?.items.find(
                                    (item) => item.id === value,
                                  );
                                chunkForm.setFieldValue(
                                  "strategyName",
                                  matched?.chunkStrategyDrafts[0]?.name,
                                );
                              }}
                            />
                          </Form.Item>
                          <Form.Item
                            label="策略名（实验模式可选）"
                            name="strategyName"
                          >
                            <Select
                              allowClear
                              options={strategyOptions}
                              placeholder="筛选指定策略"
                            />
                          </Form.Item>
                          <Form.Item label="关键词（可选）" name="keyword">
                            <Input placeholder="关键字过滤 content" />
                          </Form.Item>
                          <Form.Item label="语义 Query（可选）" name="query">
                            <Input placeholder="用于 score 计算" />
                          </Form.Item>

                          <Row gutter={[12, 0]}>
                            <Col xs={24} md={8}>
                              <Form.Item label="Page" name="page">
                                <InputNumber
                                  min={1}
                                  className={styles.numberInput}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                              <Form.Item label="Limit" name="limit">
                                <InputNumber
                                  min={1}
                                  max={100}
                                  className={styles.numberInput}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                              <Form.Item label="Offset" name="offset">
                                <InputNumber
                                  min={0}
                                  max={1000}
                                  className={styles.numberInput}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Form>

                        <Button
                          type="primary"
                          onClick={() => {
                            void handleChunkSearch();
                          }}
                          loading={chunksDebugMutation.isPending}
                        >
                          查询 Chunks
                        </Button>

                        {!chunkDebugResult ? (
                          <Alert
                            type="info"
                            showIcon
                            message="尚未查询 chunk 数据"
                          />
                        ) : (
                          <Space
                            direction="vertical"
                            className={styles.fullWidth}
                            size={12}
                          >
                            <div className={styles.tagRow}>
                              <Tag color="blue">
                                Total {chunkDebugResult.total}
                              </Tag>
                              <Tag>Limit {chunkDebugResult.limit}</Tag>
                              <Tag>Offset {chunkDebugResult.offset}</Tag>
                            </div>
                            <div className={styles.tableWrap}>
                              <Table<ChunksDebugItem>
                                rowKey="chunkId"
                                size="small"
                                columns={CHUNK_COLUMNS}
                                dataSource={chunkDebugResult.items}
                                pagination={false}
                                scroll={{ x: 980, y: 280 }}
                              />
                            </div>
                          </Space>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "runs",
                    label: "调试运行记录",
                    children: (
                      <div className={styles.chunkPanel}>
                        <div className={styles.sectionBar}>
                          <Space>
                            <Typography.Text type="secondary">
                              Limit
                            </Typography.Text>
                            <InputNumber
                              min={1}
                              max={100}
                              value={runsLimit}
                              onChange={(value) => {
                                if (typeof value === "number") {
                                  setRunsLimit(value);
                                }
                              }}
                            />
                            <Button
                              onClick={() => void ragRunsQuery.refetch()}
                              loading={ragRunsQuery.isFetching}
                            >
                              刷新
                            </Button>
                          </Space>
                        </div>

                        {ragRunsQuery.isError ? (
                          <Alert
                            type="error"
                            showIcon
                            message="读取调试运行记录失败"
                            description={parseErrorMessage(ragRunsQuery.error)}
                          />
                        ) : (
                          <div className={styles.tableWrap}>
                            <Table<RagRunRecord>
                              rowKey="runId"
                              columns={RUN_COLUMNS}
                              dataSource={ragRunsQuery.data?.items ?? []}
                              loading={
                                ragRunsQuery.isLoading ||
                                ragRunsQuery.isFetching
                              }
                              pagination={false}
                              size="small"
                              scroll={{ x: 1040, y: 350 }}
                            />
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </PageSectionCard>
        </div>
      </div>
    </div>
  );
}
