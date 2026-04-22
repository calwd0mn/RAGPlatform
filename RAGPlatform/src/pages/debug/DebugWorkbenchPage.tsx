import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { useKnowledgeBaseList } from "../../hooks/knowledge-base/useKnowledgeBaseList";
import {
  createDebugExperiment,
  getCurrentPrompt,
  getDebugExperiments,
  updateDebugExperiment,
} from "../../services/debug";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type {
  DebugExperimentCreateRequest,
  DebugExperimentRecord,
  DebugExperimentUpdateRequest,
  RagPromptCurrentResponse,
} from "../../types/debug";
import styles from "./DebugWorkbenchPage.module.css";
import {
  buildExperimentPayload,
  buildInitialExperimentFormValues,
  formatDateTime,
  getExperimentStatusColor,
  mapExperimentToForm,
  parseErrorMessage,
} from "./debugShared";
import type { ExperimentFormValues } from "./debugShared";

function createExperimentSnapshot(record: DebugExperimentRecord): Array<{
  label: string;
  value: string;
}> {
  const firstStrategy = record.chunkStrategyDrafts[0];

  return [
    { label: "状态", value: record.status },
    { label: "模式", value: record.mode },
    { label: "TopK", value: String(record.topK) },
    {
      label: "Prompt",
      value: `${record.promptDraft.basePromptId}@${record.promptDraft.versionLabel ?? "draft"}`,
    },
    {
      label: "Chunk 策略",
      value: firstStrategy
        ? `${firstStrategy.name} / ${firstStrategy.type}`
        : "未配置",
    },
    { label: "Chunk Namespace", value: record.chunkNamespace },
    { label: "Query 数量", value: String(record.queries.length) },
    { label: "更新时间", value: formatDateTime(record.updatedAt) },
  ];
}

function buildUpdatePayload(
  values: ExperimentFormValues,
  knowledgeBaseId: string,
): DebugExperimentUpdateRequest {
  const payload: DebugExperimentCreateRequest = buildExperimentPayload(
    values,
    knowledgeBaseId,
  );

  return {
    knowledgeBaseId: payload.knowledgeBaseId,
    documentIds: payload.documentIds,
    queries: payload.queries,
    promptDraft: payload.promptDraft,
    chunkStrategyDrafts: payload.chunkStrategyDrafts,
    topK: payload.topK,
    mode: payload.mode,
  };
}

export function DebugWorkbenchPage() {
  const [form] = Form.useForm<ExperimentFormValues>();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();
  const previousKnowledgeBaseIdRef = useRef<string>("");
  const navigate = useNavigate();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

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

  const selectedExperiment = useMemo(
    (): DebugExperimentRecord | undefined =>
      experimentsQuery.data?.items.find(
        (item) => item.id === selectedExperimentId,
      ),
    [experimentsQuery.data?.items, selectedExperimentId],
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
    form.resetFields();
    form.setFieldsValue(buildInitialExperimentFormValues(currentPromptQuery.data));
  }, [currentKnowledgeBaseId, currentPromptQuery.data, form]);

  useEffect(() => {
    if (selectedExperiment) {
      form.setFieldsValue(mapExperimentToForm(selectedExperiment));
    }
  }, [form, selectedExperiment]);

  const createExperimentMutation = useMutation({
    mutationFn: createDebugExperiment,
    onSuccess: (record) => {
      setSelectedExperimentId(record.id);
      form.setFieldsValue(mapExperimentToForm(record));
      void experimentsQuery.refetch();
      message.success("实验模板已创建。");
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
      setSelectedExperimentId(record.id);
      form.setFieldsValue(mapExperimentToForm(record));
      void experimentsQuery.refetch();
      message.success("实验模板已更新。");
    },
    onError: (error: Error) => {
      message.error(parseErrorMessage(error));
    },
  });

  const handleCreateExperiment = async (): Promise<void> => {
    if (currentKnowledgeBaseId.length === 0) {
      message.warning("请先选择知识库。");
      return;
    }

    const values = await form.validateFields();
    await createExperimentMutation.mutateAsync(
      buildExperimentPayload(values, currentKnowledgeBaseId),
    );
  };

  const handleUpdateExperiment = async (): Promise<void> => {
    if (!selectedExperiment) {
      message.warning("请先选择一个实验模板。");
      return;
    }

    const values = await form.validateFields();
    await updateExperimentMutation.mutateAsync({
      experimentId: selectedExperiment.id,
      payload: buildUpdatePayload(values, selectedExperiment.knowledgeBaseId),
    });
  };

  const stats = [
    {
      label: "当前知识库",
      value: currentKnowledgeBaseName,
      hint: "配置和运行都基于当前选中知识库",
    },
    {
      label: "正式 Prompt",
      value: currentPromptQuery.data?.versionedId ?? "加载中",
      hint: "新实验默认从当前正式版本初始化",
    },
    {
      label: "实验模板",
      value: String(experimentsQuery.data?.items.length ?? 0),
      hint: "可复用的参数组合",
    },
    {
      label: "当前选中",
      value: selectedExperiment?.status ?? "未选择",
      hint: selectedExperiment ? selectedExperiment.id : "创建或选择一个模板",
    },
  ];

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <Typography.Title level={4} className={styles.pageTitle}>
            策略设置
          </Typography.Title>
          <Typography.Paragraph type="secondary" className={styles.pageIntro}>
            这里只负责维护 Prompt、Chunk、Query 集和检索参数，形成可复用的调试策略模板。具体运行和结果分析请到组合调试页完成。
          </Typography.Paragraph>
        </div>

        <div className={styles.summaryGrid}>
          {stats.map((item) => (
            <div key={item.label} className={styles.summaryStat}>
              <Typography.Text type="secondary">{item.label}</Typography.Text>
              <Typography.Text strong>{item.value}</Typography.Text>
              <Typography.Text type="secondary" className={styles.statHint}>
                {item.hint}
              </Typography.Text>
            </div>
          ))}
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
          <PageSectionCard
            title="实验模板编辑"
            extra={
              <Button
                type="link"
                onClick={() => {
                  if (selectedExperimentId) {
                    navigate(`/app/debug/results?experimentId=${selectedExperimentId}`);
                    return;
                  }

                  navigate("/app/debug/results");
                }}
              >
                前往组合调试
              </Button>
            }
          >
            <div className={styles.sectionBlock}>
              <Typography.Text strong>基于正式 Prompt 初始化</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                className={styles.blockDescription}
              >
                当前表单默认采用线上 Prompt 作为草稿起点，便于你做受控改动并保存为实验模板。
              </Typography.Paragraph>
              <div className={styles.tagRow}>
                <Tag color="blue">
                  {currentPromptQuery.data?.versionedId ?? "加载中"}
                </Tag>
                <Tag>KB {currentKnowledgeBaseName}</Tag>
                <Tag>ID {currentPromptQuery.data?.id ?? "-"}</Tag>
              </div>
            </div>

            <Form<ExperimentFormValues>
              form={form}
              layout="vertical"
              initialValues={buildInitialExperimentFormValues(
                currentPromptQuery.data,
              )}
            >
              <div className={styles.formStack}>
                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <Typography.Text strong>测试集与检索参数</Typography.Text>
                    <Typography.Text type="secondary">
                      先定义要测什么，再决定检索与生成模式。
                    </Typography.Text>
                  </div>

                  <Form.Item
                    label="测试 Query 集"
                    name="queriesText"
                    rules={[{ required: true, message: "请输入至少一条 query" }]}
                  >
                    <Input.TextArea
                      autoSize={{ minRows: 6, maxRows: 12 }}
                      placeholder="每行一条 query"
                    />
                  </Form.Item>

                  <Row gutter={[12, 0]}>
                    <Col xs={24} md={8}>
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
                    <Col xs={24} md={16}>
                      <Form.Item
                        label="运行模式"
                        name="mode"
                        rules={[{ required: true, message: "请选择运行模式" }]}
                      >
                        <Select
                          options={[
                            {
                              label: "仅检索检验 retrieve-only",
                              value: "retrieve-only",
                            },
                            {
                              label: "完整 RAG full-rag",
                              value: "full-rag",
                            },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </section>

                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <Typography.Text strong>Prompt 策略</Typography.Text>
                    <Typography.Text type="secondary">
                      只保留最关键的两个可编辑层：system prompt 和上下文模板。
                    </Typography.Text>
                  </div>

                  <Row gutter={[12, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Base Prompt ID"
                        name="basePromptId"
                        rules={[{ required: true, message: "请输入 Prompt ID" }]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Prompt Version Label" name="promptVersionLabel">
                        <Input placeholder="draft / v2 / compare-a" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="System Prompt"
                    name="systemPrompt"
                    rules={[{ required: true, message: "请输入 system prompt" }]}
                  >
                    <Input.TextArea autoSize={{ minRows: 6, maxRows: 12 }} />
                  </Form.Item>

                  <Form.Item
                    label="Context Template"
                    name="contextTemplate"
                    rules={[{ required: true, message: "请输入上下文模板" }]}
                  >
                    <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} />
                  </Form.Item>
                </section>

                <section className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <Typography.Text strong>Chunk 策略</Typography.Text>
                    <Typography.Text type="secondary">
                      支持多策略草稿，但尽量保持命名清晰，这样后面结果页对比会更顺手。
                    </Typography.Text>
                  </div>

                  <Form.List name="chunkStrategyDrafts">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" className={styles.fullWidth} size={12}>
                        {fields.map((field) => (
                          <div key={field.key} className={styles.strategyCard}>
                            <Row gutter={[12, 0]}>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  {...field}
                                  label="策略名"
                                  name={[field.name, "name"]}
                                  rules={[
                                    { required: true, message: "请输入策略名" },
                                  ]}
                                >
                                  <Input placeholder="sentence-recursive-v1" />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  {...field}
                                  label="类型"
                                  name={[field.name, "type"]}
                                  rules={[
                                    { required: true, message: "请选择类型" },
                                  ]}
                                >
                                  <Select
                                    options={[
                                      { label: "recursive", value: "recursive" },
                                      { label: "markdown", value: "markdown" },
                                      { label: "token", value: "token" },
                                    ]}
                                  />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={8}>
                                <Form.Item
                                  {...field}
                                  label="Version Label"
                                  name={[field.name, "versionLabel"]}
                                >
                                  <Input placeholder="draft / v1" />
                                </Form.Item>
                              </Col>
                            </Row>

                            <Row gutter={[12, 0]}>
                              <Col xs={24} md={8}>
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
                              <Col xs={24} md={8}>
                                <Form.Item
                                  {...field}
                                  label="Chunk Overlap"
                                  name={[field.name, "chunkOverlap"]}
                                  rules={[
                                    { required: true, message: "请输入 overlap" },
                                  ]}
                                >
                                  <InputNumber
                                    min={0}
                                    max={4000}
                                    className={styles.numberInput}
                                  />
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
                            </Row>

                            <Row gutter={[12, 0]}>
                              <Col xs={24} md={12}>
                                <Form.Item
                                  {...field}
                                  label="Separators"
                                  name={[field.name, "separatorsText"]}
                                >
                                  <Input.TextArea
                                    autoSize={{ minRows: 2, maxRows: 6 }}
                                    placeholder="逗号或换行分隔"
                                  />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={12}>
                                <Form.Item
                                  {...field}
                                  label="优先保留句子边界"
                                  name={[field.name, "preserveSentenceBoundary"]}
                                  valuePropName="checked"
                                >
                                  <Switch />
                                </Form.Item>
                              </Col>
                            </Row>

                            {fields.length > 1 ? (
                              <Button danger onClick={() => remove(field.name)}>
                                删除该策略
                              </Button>
                            ) : null}
                          </div>
                        ))}

                        <Button
                          onClick={() =>
                            add({
                              name: "",
                              type: "recursive",
                              chunkSize: 800,
                              chunkOverlap: 150,
                              preserveSentenceBoundary: true,
                            })
                          }
                        >
                          新增 Chunk 策略
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </section>
              </div>
            </Form>

            <div className={styles.actionBar}>
              <Space wrap>
                <Button
                  type="primary"
                  onClick={() => {
                    void handleCreateExperiment();
                  }}
                  loading={createExperimentMutation.isPending}
                >
                  创建模板
                </Button>
                <Button
                  onClick={() => {
                    void handleUpdateExperiment();
                  }}
                  loading={updateExperimentMutation.isPending}
                >
                  更新模板
                </Button>
                <Button
                  onClick={() => {
                    if (selectedExperimentId) {
                      navigate(`/app/debug/results?experimentId=${selectedExperimentId}`);
                      return;
                    }

                    message.info("先创建或选择实验模板，再进入结果台。");
                  }}
                >
                  去组合调试
                </Button>
              </Space>
            </div>
          </PageSectionCard>
        </div>

        <div className={styles.secondaryColumn}>
          <PageSectionCard
            title="实验模板列表"
            extra={
              <Button onClick={() => void experimentsQuery.refetch()}>刷新</Button>
            }
          >
            {experimentsQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message="读取实验列表失败"
                description={parseErrorMessage(experimentsQuery.error)}
              />
            ) : (
              <List<DebugExperimentRecord>
                loading={experimentsQuery.isLoading || experimentsQuery.isFetching}
                dataSource={experimentsQuery.data?.items ?? []}
                renderItem={(item) => (
                  <List.Item
                    className={
                      item.id === selectedExperimentId
                        ? styles.selectedListItem
                        : styles.listItem
                    }
                    onClick={() => {
                      setSelectedExperimentId(item.id);
                    }}
                  >
                    <div className={styles.listItemHeader}>
                      <Typography.Text strong>{item.chunkNamespace}</Typography.Text>
                      <Tag color={getExperimentStatusColor(item.status)}>
                        {item.status}
                      </Tag>
                    </div>
                    <div className={styles.tagRow}>
                      <Tag>{item.mode}</Tag>
                      <Tag>TopK {item.topK}</Tag>
                      <Tag>{item.chunkStrategyDrafts.length} 策略</Tag>
                      <Tag>{item.queries.length} Queries</Tag>
                    </div>
                    <Typography.Paragraph
                      type="secondary"
                      className={styles.listMeta}
                    >
                      更新于 {formatDateTime(item.updatedAt)}
                    </Typography.Paragraph>
                  </List.Item>
                )}
              />
            )}
          </PageSectionCard>

          <PageSectionCard title="当前模板快照">
            {!selectedExperiment ? (
              <Alert
                type="info"
                showIcon
                message="尚未选择实验模板"
                description="从上方列表选择一条模板后，这里会展示当前参数摘要。"
              />
            ) : (
              <div className={styles.snapshotGrid}>
                {createExperimentSnapshot(selectedExperiment).map((item) => (
                  <div key={item.label} className={styles.snapshotItem}>
                    <Typography.Text type="secondary">{item.label}</Typography.Text>
                    <Typography.Text strong>{item.value}</Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </PageSectionCard>
        </div>
      </div>
    </div>
  );
}
