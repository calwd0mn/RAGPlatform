import {
  Alert,
  Button,
  Col,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ExpandOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import JsonView from "@uiw/react-json-view";
import { useMemo, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { useDocumentList } from "../../hooks/document/useDocumentList";
import { toDocumentDisplayStatus } from "../../utils/document-status";
import styles from "./DebugWorkbenchPage.module.css";

interface StageMetric {
  key: string;
  name: string;
  latencyMs: number;
  color: string;
}

interface PromptChunkTunePayload {
  knowledgeBaseId: string;
  query: string;
  prompt: {
    systemTemplate: string;
    contextJoiner: "double_newline" | "xml_block" | "json_block";
    includeCitationHint: boolean;
    maxContextChunks: number;
  };
  chunk: {
    size: number;
    overlap: number;
    boundary: "paragraph" | "sentence" | "hybrid";
    keepTitlePrefix: boolean;
  };
  documentScope: string[];
}

interface DebugSnapshot {
  id: string;
  label: string;
  createdAt: string;
  payload: PromptChunkTunePayload;
}

interface SnapshotDiffRow {
  key: string;
  field: string;
  left: string;
  right: string;
  status: "same" | "changed";
}

const STAGE_METRICS: StageMetric[] = [
  { key: "embedding", name: "Embedding", latencyMs: 81, color: "#2563eb" },
  { key: "retrieval", name: "Vector Search", latencyMs: 132, color: "#0ea5e9" },
  { key: "prompt", name: "Prompt Build", latencyMs: 47, color: "#14b8a6" },
  { key: "ttft", name: "LLM First Token", latencyMs: 468, color: "#f97316" },
  { key: "generation", name: "Total Generation", latencyMs: 1426, color: "#6366f1" },
];

const LATENCY_COLUMNS: ColumnsType<StageMetric> = [
  { title: "Stage", dataIndex: "name", key: "name" },
  {
    title: "Latency",
    dataIndex: "latencyMs",
    key: "latencyMs",
    width: 160,
    render: (value: number) => `${value} ms`,
  },
];

const SNAPSHOT_DIFF_COLUMNS: ColumnsType<SnapshotDiffRow> = [
  {
    title: "参数项",
    dataIndex: "field",
    key: "field",
    width: 180,
  },
  {
    title: "快照 A",
    dataIndex: "left",
    key: "left",
  },
  {
    title: "快照 B",
    dataIndex: "right",
    key: "right",
  },
  {
    title: "变化",
    dataIndex: "status",
    key: "status",
    width: 120,
    render: (value: SnapshotDiffRow["status"]) =>
      value === "changed" ? <Tag color="warning">Changed</Tag> : <Tag>Same</Tag>,
  },
];

const DEFAULT_SYSTEM_PROMPT =
  "你是企业知识库问答助手。请严格基于检索到的上下文回答，不确定时明确说明证据不足。";

function buildPromptPreview(
  systemTemplate: string,
  contextJoiner: PromptChunkTunePayload["prompt"]["contextJoiner"],
  query: string,
): string {
  return `System:
${systemTemplate}

Context:
{{context_chunks | ${contextJoiner}}}

User:
${query || "{{query}}"}`;
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

function formatSnapshotLabel(index: number): string {
  return `快照 #${index + 1}`;
}

export function DebugWorkbenchPage() {
  const documentListQuery = useDocumentList();
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("default-kb");
  const [query, setQuery] = useState("为什么这次没有命中预期文档？");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [systemTemplate, setSystemTemplate] = useState(DEFAULT_SYSTEM_PROMPT);
  const [contextJoiner, setContextJoiner] =
    useState<PromptChunkTunePayload["prompt"]["contextJoiner"]>("double_newline");
  const [includeCitationHint, setIncludeCitationHint] = useState(true);
  const [maxContextChunks, setMaxContextChunks] = useState(5);
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [chunkBoundary, setChunkBoundary] =
    useState<PromptChunkTunePayload["chunk"]["boundary"]>("hybrid");
  const [keepTitlePrefix, setKeepTitlePrefix] = useState(true);
  const [jsonSearchText, setJsonSearchText] = useState("");
  const [jsonCollapsed, setJsonCollapsed] = useState<number>(2);
  const [snapshots, setSnapshots] = useState<DebugSnapshot[]>([]);
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  const readyDocuments = useMemo(() => {
    const items = documentListQuery.data ?? [];
    return items.filter((item) => toDocumentDisplayStatus(item.status) === "ready");
  }, [documentListQuery.data]);

  const documentOptions = useMemo(
    () =>
      readyDocuments.map((item) => ({
        label: item.filename,
        value: item.id,
      })),
    [readyDocuments],
  );

  const tunePayload: PromptChunkTunePayload = useMemo(
    () => ({
      knowledgeBaseId: knowledgeBaseId.trim(),
      query: query.trim(),
      prompt: {
        systemTemplate: systemTemplate.trim(),
        contextJoiner,
        includeCitationHint,
        maxContextChunks,
      },
      chunk: {
        size: chunkSize,
        overlap: chunkOverlap,
        boundary: chunkBoundary,
        keepTitlePrefix,
      },
      documentScope: selectedDocumentIds,
    }),
    [
      chunkBoundary,
      chunkOverlap,
      chunkSize,
      contextJoiner,
      includeCitationHint,
      knowledgeBaseId,
      maxContextChunks,
      query,
      selectedDocumentIds,
      systemTemplate,
      keepTitlePrefix,
    ],
  );

  const totalLatency = useMemo(
    () => STAGE_METRICS.reduce((sum, item) => sum + item.latencyMs, 0),
    [],
  );
  const maxLatency = useMemo(
    () => Math.max(...STAGE_METRICS.map((item) => item.latencyMs)),
    [],
  );
  const promptPreview = useMemo(
    () => buildPromptPreview(systemTemplate, contextJoiner, query),
    [contextJoiner, query, systemTemplate],
  );
  const payloadPreviewText = useMemo(
    () => JSON.stringify(tunePayload, null, 2),
    [tunePayload],
  );

  const searchMatches = useMemo(() => {
    const search = normalizeForMatch(jsonSearchText);
    if (!search) {
      return 0;
    }
    return normalizeForMatch(payloadPreviewText).includes(search) ? 1 : 0;
  }, [jsonSearchText, payloadPreviewText]);

  const overlapRatio = Math.round((chunkOverlap / Math.max(chunkSize, 1)) * 100);

  const snapshotOptions = useMemo(
    () =>
      snapshots.map((item) => ({
        label: `${item.label} (${item.createdAt})`,
        value: item.id,
      })),
    [snapshots],
  );

  const compareLeftSnapshot = useMemo(
    () => snapshots.find((item) => item.id === compareLeftId),
    [compareLeftId, snapshots],
  );
  const compareRightSnapshot = useMemo(
    () => snapshots.find((item) => item.id === compareRightId),
    [compareRightId, snapshots],
  );

  const snapshotDiffRows = useMemo<SnapshotDiffRow[]>(() => {
    if (!compareLeftSnapshot || !compareRightSnapshot) {
      return [];
    }

    const rows = [
      {
        key: "chunk-size",
        field: "chunk.size",
        left: String(compareLeftSnapshot.payload.chunk.size),
        right: String(compareRightSnapshot.payload.chunk.size),
      },
      {
        key: "chunk-overlap",
        field: "chunk.overlap",
        left: String(compareLeftSnapshot.payload.chunk.overlap),
        right: String(compareRightSnapshot.payload.chunk.overlap),
      },
      {
        key: "chunk-boundary",
        field: "chunk.boundary",
        left: compareLeftSnapshot.payload.chunk.boundary,
        right: compareRightSnapshot.payload.chunk.boundary,
      },
      {
        key: "prompt-max-context",
        field: "prompt.maxContextChunks",
        left: String(compareLeftSnapshot.payload.prompt.maxContextChunks),
        right: String(compareRightSnapshot.payload.prompt.maxContextChunks),
      },
      {
        key: "prompt-joiner",
        field: "prompt.contextJoiner",
        left: compareLeftSnapshot.payload.prompt.contextJoiner,
        right: compareRightSnapshot.payload.prompt.contextJoiner,
      },
    ];

    return rows.map((row) => ({
      ...row,
      status:
        normalizeForMatch(row.left) === normalizeForMatch(row.right)
          ? "same"
          : "changed",
    }));
  }, [compareLeftSnapshot, compareRightSnapshot]);

  const handleReset = () => {
    setKnowledgeBaseId("default-kb");
    setQuery("为什么这次没有命中预期文档？");
    setSelectedDocumentIds([]);
    setSystemTemplate(DEFAULT_SYSTEM_PROMPT);
    setContextJoiner("double_newline");
    setIncludeCitationHint(true);
    setMaxContextChunks(5);
    setChunkSize(800);
    setChunkOverlap(120);
    setChunkBoundary("hybrid");
    setKeepTitlePrefix(true);
  };

  const handleSaveSnapshot = () => {
    const nextId = `${Date.now()}`;
    const createdAt = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const nextSnapshot: DebugSnapshot = {
      id: nextId,
      label: formatSnapshotLabel(snapshots.length),
      createdAt,
      payload: tunePayload,
    };

    const nextSnapshots = [...snapshots, nextSnapshot].slice(-8);
    setSnapshots(nextSnapshots);
    if (!compareLeftId) {
      setCompareLeftId(nextId);
    } else if (!compareRightId || compareRightId === compareLeftId) {
      setCompareRightId(nextId);
    } else {
      setCompareRightId(nextId);
    }
  };

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <div>
          <Typography.Title level={4} className={styles.pageTitle}>
            调试工作台
          </Typography.Title>
          <Typography.Text type="secondary">
            以知识库为单位调试 Prompt 与 Chunk 策略，观察参数变化对性能的影响。
          </Typography.Text>
        </div>
        <Space size={8} wrap>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置参数
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSaveSnapshot}>
            保存当前快照
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />}>
            执行一次调试
          </Button>
        </Space>
      </header>

      <Row gutter={[16, 16]} className={styles.layoutRow}>
        <Col xs={24} xl={9} className={styles.stretchCol}>
          <PageSectionCard title="知识库调试上下文">
            <Space direction="vertical" size={12} className={styles.fullWidth}>
              <label className={styles.field}>
                <Typography.Text type="secondary">Knowledge Base ID</Typography.Text>
                <Input
                  value={knowledgeBaseId}
                  onChange={(event) => setKnowledgeBaseId(event.target.value)}
                  placeholder="输入知识库 ID"
                />
              </label>
              <label className={styles.field}>
                <Typography.Text type="secondary">调试 Query</Typography.Text>
                <Input.TextArea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  placeholder="输入要回放的用户问题"
                />
              </label>
              <label className={styles.field}>
                <Typography.Text type="secondary">文档范围（可选）</Typography.Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={
                    documentOptions.length
                      ? "选择文档范围，不选则默认使用知识库全量"
                      : "暂无 ready 文档"
                  }
                  options={documentOptions}
                  value={selectedDocumentIds}
                  onChange={setSelectedDocumentIds}
                />
              </label>
              <Alert
                type="info"
                showIcon
                message={`当前可问答文档 ${readyDocuments.length} 个`}
                description="调试页按知识库维度工作；如果后端暂未支持 documentScope，会自动忽略此字段。"
              />
            </Space>
          </PageSectionCard>
        </Col>

        <Col xs={24} xl={15} className={styles.stretchCol}>
          <PageSectionCard title="调参面板（Prompt + Chunk）">
            <div className={styles.tuneGrid}>
              <section className={styles.tuneSection}>
                <Typography.Text strong className={styles.sectionTitle}>
                  Prompt 策略
                </Typography.Text>

                <div className={styles.editorHeader}>
                  <Typography.Text type="secondary">System Template</Typography.Text>
                  <Button
                    size="small"
                    icon={<ExpandOutlined />}
                    onClick={() => setPromptEditorOpen(true)}
                  >
                    全屏编辑
                  </Button>
                </div>
                <Input.TextArea
                  value={systemTemplate}
                  onChange={(event) => setSystemTemplate(event.target.value)}
                  autoSize={{ minRows: 8, maxRows: 16 }}
                />

                <label className={styles.field}>
                  <Typography.Text type="secondary">Context 拼接方式</Typography.Text>
                  <Select
                    value={contextJoiner}
                    onChange={(value) => setContextJoiner(value)}
                    options={[
                      { label: "双换行", value: "double_newline" },
                      { label: "XML Block", value: "xml_block" },
                      { label: "JSON Block", value: "json_block" },
                    ]}
                  />
                </label>

                <div className={styles.toggleRow}>
                  <Typography.Text type="secondary">追加 citation 输出提示</Typography.Text>
                  <Switch
                    checked={includeCitationHint}
                    onChange={setIncludeCitationHint}
                  />
                </div>

                <div className={styles.numberRow}>
                  <Typography.Text type="secondary">最大上下文块数</Typography.Text>
                  <InputNumber
                    min={1}
                    max={20}
                    value={maxContextChunks}
                    onChange={(value) => {
                      if (typeof value === "number") {
                        setMaxContextChunks(value);
                      }
                    }}
                  />
                </div>
              </section>

              <section className={styles.tuneSection}>
                <Typography.Text strong className={styles.sectionTitle}>
                  Chunk 策略
                </Typography.Text>

                <div className={styles.numberRow}>
                  <Typography.Text type="secondary">Chunk Size</Typography.Text>
                  <InputNumber
                    min={128}
                    max={4096}
                    step={64}
                    value={chunkSize}
                    onChange={(value) => {
                      if (typeof value === "number") {
                        setChunkSize(value);
                      }
                    }}
                  />
                </div>

                <div className={styles.numberRow}>
                  <Typography.Text type="secondary">Chunk Overlap</Typography.Text>
                  <InputNumber
                    min={0}
                    max={2048}
                    step={32}
                    value={chunkOverlap}
                    onChange={(value) => {
                      if (typeof value === "number") {
                        setChunkOverlap(value);
                      }
                    }}
                  />
                </div>

                <label className={styles.field}>
                  <Typography.Text type="secondary">边界策略</Typography.Text>
                  <Select
                    value={chunkBoundary}
                    onChange={(value) => setChunkBoundary(value)}
                    options={[
                      { label: "段落优先", value: "paragraph" },
                      { label: "句子优先", value: "sentence" },
                      { label: "混合策略", value: "hybrid" },
                    ]}
                  />
                </label>

                <div className={styles.toggleRow}>
                  <Typography.Text type="secondary">保留标题前缀</Typography.Text>
                  <Switch checked={keepTitlePrefix} onChange={setKeepTitlePrefix} />
                </div>

                <Alert
                  type={overlapRatio < 10 || overlapRatio > 45 ? "warning" : "success"}
                  showIcon
                  message={`Overlap 占比 ${overlapRatio}%`}
                  description={
                    overlapRatio < 10
                      ? "可能导致语义跨块断裂。"
                      : overlapRatio > 45
                        ? "可能造成冗余与检索噪声。"
                        : "处于推荐区间（10%~45%）。"
                  }
                />
              </section>
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24} xl={12} className={styles.stretchCol}>
          <PageSectionCard title="Prompt Inspector" extra={<Tag color="blue">调试结果</Tag>}>
            <div className={`${styles.resultSurface} ${styles.resultPrompt}`}>
              <Space direction="vertical" size={10} className={styles.fullWidth}>
                <div className={styles.promptLegend}>
                  <Tag color="blue">Instructions</Tag>
                  <Tag color="gold">Grounding Placeholder</Tag>
                  <Tag color="purple">User Query</Tag>
                </div>
                <pre className={styles.promptPreview}>{promptPreview}</pre>
                <Typography.Text type="secondary">
                  当前是前端拼接预览，后续可与后端返回的最终 prompt 做 diff 对比。
                </Typography.Text>
              </Space>
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24} xl={12} className={styles.stretchCol}>
          <PageSectionCard title="性能拆解（Latency Breakdown）" extra={<Tag color="processing">Total {totalLatency} ms</Tag>}>
            <div className={`${styles.resultSurface} ${styles.resultLatency}`}>
              <Space direction="vertical" size={14} className={styles.fullWidth}>
                {STAGE_METRICS.map((stage) => {
                  const ratio = (stage.latencyMs / maxLatency) * 100;
                  return (
                    <div key={stage.key} className={styles.timelineRow}>
                      <Typography.Text className={styles.timelineName}>
                        {stage.name}
                      </Typography.Text>
                      <div className={styles.timelineBarWrap}>
                        <div
                          className={styles.timelineBar}
                          style={{ width: `${ratio}%`, backgroundColor: stage.color }}
                        />
                      </div>
                      <Typography.Text strong>{stage.latencyMs} ms</Typography.Text>
                    </div>
                  );
                })}

                <Table<StageMetric>
                  rowKey="key"
                  size="small"
                  pagination={false}
                  columns={LATENCY_COLUMNS}
                  dataSource={STAGE_METRICS}
                />
              </Space>
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24} xl={12} className={styles.stretchCol}>
          <PageSectionCard title="Chunk 策略预览">
            <Space direction="vertical" size={10} className={styles.fullWidth}>
              <div className={styles.chunkMetricRow}>
                <Tag color="processing">Size {chunkSize}</Tag>
                <Tag color="processing">Overlap {chunkOverlap}</Tag>
                <Tag>{chunkBoundary}</Tag>
              </div>
              <div className={styles.chunkPreviewBlock}>
                <Typography.Text strong>Chunk #41</Typography.Text>
                <Typography.Paragraph className={styles.chunkPreviewText}>
                  ...示例正文片段 A（长度约 {chunkSize}）...
                </Typography.Paragraph>
              </div>
              <div className={styles.chunkPreviewBlock}>
                <Typography.Text strong>Chunk #42</Typography.Text>
                <Typography.Paragraph className={styles.chunkPreviewText}>
                  ...示例正文片段 B，前 {chunkOverlap} 字与上一个块重叠...
                </Typography.Paragraph>
              </div>
              <Alert
                type="info"
                showIcon
                message="该区块预留给真实 chunk 邻近预览与语义断裂告警。"
              />
            </Space>
          </PageSectionCard>
        </Col>

        <Col xs={24} xl={12} className={styles.stretchCol}>
          <PageSectionCard title="调参请求 JSON">
            <Space direction="vertical" size={10} className={styles.fullWidth}>
              <div className={styles.jsonToolbar}>
                <Input
                  placeholder="搜索 JSON 内容"
                  value={jsonSearchText}
                  onChange={(event) => setJsonSearchText(event.target.value)}
                />
                <InputNumber
                  min={1}
                  max={6}
                  value={jsonCollapsed}
                  onChange={(value) => {
                    if (typeof value === "number") {
                      setJsonCollapsed(value);
                    }
                  }}
                />
              </div>
              <Typography.Text type="secondary">
                {jsonSearchText.trim()
                  ? searchMatches > 0
                    ? `已匹配关键词：${jsonSearchText}`
                    : `未匹配关键词：${jsonSearchText}`
                  : "支持折叠层级调整（右侧数字）。"}
              </Typography.Text>
              <div className={styles.jsonViewerWrap}>
                <JsonView
                  value={tunePayload}
                  collapsed={jsonCollapsed}
                  displayDataTypes={false}
                  displayObjectSize={true}
                  enableClipboard={true}
                  objectSortKeys={false}
                />
              </div>
              {jsonSearchText.trim() && searchMatches === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="未找到匹配项"
                  description="可以尝试搜索 chunk、prompt、knowledgeBaseId 等关键词。"
                />
              ) : null}
            </Space>
          </PageSectionCard>
        </Col>

        <Col xs={24} className={styles.stretchCol}>
          <PageSectionCard title="快照对比模式">
            <Space direction="vertical" size={12} className={styles.fullWidth}>
              <div className={styles.compareToolbar}>
                <Select
                  className={styles.compareSelect}
                  placeholder="选择快照 A"
                  options={snapshotOptions}
                  value={compareLeftId || undefined}
                  onChange={setCompareLeftId}
                />
                <Select
                  className={styles.compareSelect}
                  placeholder="选择快照 B"
                  options={snapshotOptions}
                  value={compareRightId || undefined}
                  onChange={setCompareRightId}
                />
              </div>

              {!compareLeftSnapshot || !compareRightSnapshot ? (
                <Alert
                  type="info"
                  showIcon
                  message="先保存至少两个快照，再选择 A/B 做参数对比。"
                />
              ) : (
                <>
                  <Table<SnapshotDiffRow>
                    rowKey="key"
                    size="small"
                    pagination={false}
                    columns={SNAPSHOT_DIFF_COLUMNS}
                    dataSource={snapshotDiffRows}
                  />
                  <div className={styles.compareJsonGrid}>
                    <section className={styles.compareJsonBlock}>
                      <Typography.Text strong>{compareLeftSnapshot.label}</Typography.Text>
                      <Typography.Text type="secondary">
                        {compareLeftSnapshot.createdAt}
                      </Typography.Text>
                      <div className={styles.jsonViewerWrap}>
                        <JsonView
                          value={compareLeftSnapshot.payload}
                          collapsed={2}
                          displayDataTypes={false}
                          enableClipboard={true}
                        />
                      </div>
                    </section>
                    <section className={styles.compareJsonBlock}>
                      <Typography.Text strong>{compareRightSnapshot.label}</Typography.Text>
                      <Typography.Text type="secondary">
                        {compareRightSnapshot.createdAt}
                      </Typography.Text>
                      <div className={styles.jsonViewerWrap}>
                        <JsonView
                          value={compareRightSnapshot.payload}
                          collapsed={2}
                          displayDataTypes={false}
                          enableClipboard={true}
                        />
                      </div>
                    </section>
                  </div>
                </>
              )}
            </Space>
          </PageSectionCard>
        </Col>
      </Row>

      <Modal
        title="全屏编辑 Prompt Template"
        open={promptEditorOpen}
        onCancel={() => setPromptEditorOpen(false)}
        onOk={() => setPromptEditorOpen(false)}
        width={980}
        okText="完成"
        cancelText="取消"
      >
        <Input.TextArea
          value={systemTemplate}
          onChange={(event) => setSystemTemplate(event.target.value)}
          autoSize={{ minRows: 22, maxRows: 28 }}
        />
      </Modal>
    </div>
  );
}
