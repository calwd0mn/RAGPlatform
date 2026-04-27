import {
  BranchesOutlined,
  ExportOutlined,
  FileSearchOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Collapse,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import type { CollapseProps } from "antd";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import {
  ConditionWorkflowNode,
  OutputWorkflowNode,
  RagWorkflowNode,
  StartWorkflowNode,
  UserInputWorkflowNode,
  type WorkflowFlowNode,
} from "../../components/workflow/WorkflowNodes";
import { queryKeys } from "../../constants/queryKeys";
import { runWorkflowStream } from "../../services/workflows";
import {
  getCurrentWorkflow,
  updateWorkflow,
} from "../../services/workflows";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type {
  WorkflowConditionItem,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeExecution,
  WorkflowNodeType,
  WorkflowRecord,
  WorkflowRunFinal,
  WorkflowRunInputs,
  WorkflowStreamEvent,
} from "../../types/workflow";
import styles from "./WorkflowPage.module.css";

const NODE_TYPES = [
  {
    type: "start",
    label: "开始",
    icon: <PlayCircleOutlined />,
  },
  {
    type: "userInput",
    label: "用户输入",
    icon: <UserOutlined />,
  },
  {
    type: "rag",
    label: "RAG 检索",
    icon: <FileSearchOutlined />,
  },
  {
    type: "condition",
    label: "条件分支",
    icon: <BranchesOutlined />,
  },
  {
    type: "output",
    label: "输出",
    icon: <ExportOutlined />,
  },
] satisfies Array<{ type: WorkflowNodeType; label: string; icon: ReactNode }>;

const nodeTypes = {
  start: StartWorkflowNode,
  userInput: UserInputWorkflowNode,
  rag: RagWorkflowNode,
  condition: ConditionWorkflowNode,
  output: OutputWorkflowNode,
} satisfies NodeTypes;

function createNodeData(type: WorkflowNodeType): WorkflowNodeData {
  if (type === "start") {
    return { nodeType: "start", label: "开始" };
  }
  if (type === "userInput") {
    return { nodeType: "userInput", label: "用户输入", inputField: "question" };
  }
  if (type === "rag") {
    return {
      nodeType: "rag",
      label: "RAG 检索",
      query: "{{user_input.value}}",
      topK: 5,
    };
  }
  if (type === "condition") {
    return {
      nodeType: "condition",
      label: "条件分支",
      conditions: [
        {
          variable: "{{rag_search.retrievedCount}}",
          operator: ">",
          value: 0,
        },
      ],
    };
  }
  return {
    nodeType: "output",
    label: "输出",
    outputValue: "{{user_input.value}}",
  };
}

function toFlowNodes(nodes: WorkflowNode[]): WorkflowFlowNode[] {
  return nodes.map(
    (node): WorkflowFlowNode => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }),
  );
}

function toWorkflowNodes(nodes: WorkflowFlowNode[]): WorkflowNode[] {
  return nodes.map((node): WorkflowNode => {
    const { executionStatus: _executionStatus, ...data } = node.data;
    return {
      id: node.id,
      type: node.type ?? data.nodeType,
      position: node.position,
      data,
    };
  });
}

function toFlowEdges(edges: WorkflowEdge[]): Edge[] {
  return edges.map(
    (edge): Edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      animated: false,
    }),
  );
}

function toWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((edge): WorkflowEdge => {
    const sourceHandle =
      edge.sourceHandle === "true" || edge.sourceHandle === "false"
        ? edge.sourceHandle
        : undefined;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
    };
  });
}

function parseRunInputs(inputText: string): WorkflowRunInputs {
  const parsed = JSON.parse(inputText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("输入参数必须是 JSON 对象。");
  }
  return parsed as WorkflowRunInputs;
}

function parseConditions(value: string): WorkflowConditionItem[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("条件必须是数组。");
  }
  return parsed.map((item): WorkflowConditionItem => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("条件项必须是对象。");
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.variable !== "string" ||
      typeof record.operator !== "string" ||
      !["===", "!==", ">", "<", ">=", "<=", "contains"].includes(
        record.operator,
      )
    ) {
      throw new Error("条件项格式不正确。");
    }
    const valueType = typeof record.value;
    if (!["string", "number", "boolean"].includes(valueType)) {
      throw new Error("条件值只支持 string、number 或 boolean。");
    }
    return {
      variable: record.variable,
      operator: record.operator as WorkflowConditionItem["operator"],
      value: record.value as WorkflowConditionItem["value"],
    };
  });
}

function formatOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  return JSON.stringify(output, null, 2);
}

function getExecutionSummary(item: WorkflowNodeExecution): string {
  const output = item.output;
  if (!output || typeof output !== "object") {
    return item.error ?? "等待输出";
  }
  if ("field" in output && "value" in output) {
    return `${String(output.field)} = ${String(output.value).slice(0, 48)}`;
  }
  if ("retrievedCount" in output && "retrievalProvider" in output) {
    return `命中 ${String(output.retrievedCount)} 条 · ${String(output.retrievalProvider)}`;
  }
  if ("result" in output) {
    return String(output.result);
  }
  if ("finalOutput" in output) {
    return "已生成最终答案";
  }
  if ("started" in output) {
    return "已开始";
  }
  return "已完成";
}

function getStatusTag(status: WorkflowNodeExecution["status"]) {
  if (status === "success") {
    return <Tag color="success">成功</Tag>;
  }
  if (status === "running") {
    return <Tag color="processing">运行中</Tag>;
  }
  if (status === "failed") {
    return <Tag color="error">失败</Tag>;
  }
  return <Tag>跳过</Tag>;
}

function WorkflowCanvasSurface(props: {
  flowNodes: WorkflowFlowNode[];
  flowEdges: Edge[];
  onNodesChange: (changes: NodeChange<WorkflowFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectNode: (nodeId: string) => void;
  onAddNode: (node: WorkflowFlowNode) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/workflow-node",
      ) as WorkflowNodeType;
      if (!NODE_TYPES.some((item) => item.type === type)) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      props.onAddNode({
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: createNodeData(type),
      });
    },
    [props, screenToFlowPosition],
  );

  return (
    <div
      className={styles.canvas}
      ref={canvasRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={props.flowNodes}
        edges={props.flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={props.onConnect}
        onNodeClick={(_event, node) => props.onSelectNode(node.id)}
        fitView
      >
        <Background gap={18} color="#e5e7eb" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

function NodePanel() {
  return (
    <PageSectionCard title="节点库" className={styles.sideCard}>
      <div className={styles.nodeList}>
        {NODE_TYPES.map((nodeType) => (
          <button
            key={nodeType.type}
            className={styles.nodePaletteItem}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/workflow-node",
                nodeType.type,
              );
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            <span className={styles.nodePaletteIcon}>{nodeType.icon}</span>
            <span>{nodeType.label}</span>
          </button>
        ))}
      </div>
    </PageSectionCard>
  );
}

function ConfigPanel(props: {
  selectedNode: WorkflowFlowNode | null;
  onUpdateNodeData: (nodeId: string, data: WorkflowNodeData) => void;
}) {
  const selectedNode = props.selectedNode;

  if (!selectedNode) {
    return (
      <PageSectionCard title="节点配置" className={styles.sideCard}>
        <Empty description="选择节点以编辑配置" />
      </PageSectionCard>
    );
  }

  const updateLabel = (label: string): void => {
    props.onUpdateNodeData(selectedNode.id, {
      ...selectedNode.data,
      label,
    } as WorkflowNodeData);
  };

  const commonLabel = (
    <Form.Item label="节点名称">
      <Input
        value={selectedNode.data.label}
        onChange={(event) => updateLabel(event.target.value)}
      />
    </Form.Item>
  );

  const renderFields = () => {
    if (selectedNode.data.nodeType === "start") {
      return <Typography.Text type="secondary">工作流入口节点。</Typography.Text>;
    }
    if (selectedNode.data.nodeType === "userInput") {
      return (
        <Form.Item label="输入字段">
          <Input
            value={selectedNode.data.inputField}
            onChange={(event) =>
              props.onUpdateNodeData(selectedNode.id, {
                ...selectedNode.data,
                inputField: event.target.value,
              })
            }
          />
        </Form.Item>
      );
    }
    if (selectedNode.data.nodeType === "rag") {
      return (
        <>
          <Form.Item label="检索查询">
            <Input.TextArea
              rows={4}
              value={selectedNode.data.query}
              onChange={(event) =>
                props.onUpdateNodeData(selectedNode.id, {
                  ...selectedNode.data,
                  query: event.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="Top K">
            <InputNumber
              min={1}
              max={20}
              value={selectedNode.data.topK}
              onChange={(value) =>
                props.onUpdateNodeData(selectedNode.id, {
                  ...selectedNode.data,
                  topK: value ?? 5,
                })
              }
            />
          </Form.Item>
        </>
      );
    }
    if (selectedNode.data.nodeType === "condition") {
      return (
        <Form.Item label="条件 JSON">
          <Input.TextArea
            rows={7}
            value={JSON.stringify(selectedNode.data.conditions, null, 2)}
            onChange={(event) => {
              try {
                props.onUpdateNodeData(selectedNode.id, {
                  ...selectedNode.data,
                  conditions: parseConditions(event.target.value),
                });
              } catch {
                // Keep invalid JSON in the textarea impossible with controlled derived value.
              }
            }}
          />
        </Form.Item>
      );
    }
    return (
      <Form.Item label="输出问题模板">
        <Input.TextArea
          rows={5}
          value={selectedNode.data.outputValue}
          onChange={(event) =>
            props.onUpdateNodeData(selectedNode.id, {
              ...selectedNode.data,
              outputValue: event.target.value,
            })
          }
        />
      </Form.Item>
    );
  };

  return (
    <PageSectionCard title="节点配置" className={styles.sideCard}>
      <Form layout="vertical" className={styles.configForm}>
        {commonLabel}
        {renderFields()}
      </Form>
    </PageSectionCard>
  );
}

function RunPanel(props: {
  workflowId: string;
  executions: Record<string, WorkflowNodeExecution>;
  finalResult: WorkflowRunFinal | null;
  onRunEvent: (event: WorkflowStreamEvent) => void;
  onClear: () => void;
}) {
  const [inputsText, setInputsText] = useState(
    '{\n  "question": "请介绍一下当前知识库的核心内容"\n}',
  );
  const [running, setRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRun = async (): Promise<void> => {
    let inputs: WorkflowRunInputs;
    try {
      inputs = parseRunInputs(inputsText);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "输入 JSON 无效。");
      return;
    }

    props.onClear();
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    setRunning(true);
    try {
      await runWorkflowStream(props.workflowId, inputs, {
        signal: abortController.signal,
        onEvent: props.onRunEvent,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      message.error(error instanceof Error ? error.message : "工作流运行失败。");
    } finally {
      setRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = (): void => {
    abortControllerRef.current?.abort();
    setRunning(false);
  };

  const executionItems = Object.values(props.executions);
  const successCount = executionItems.filter(
    (item) => item.status === "success",
  ).length;
  const failedCount = executionItems.filter(
    (item) => item.status === "failed",
  ).length;
  const skippedCount = executionItems.filter(
    (item) => item.status === "skipped",
  ).length;
  const collapseItems: CollapseProps["items"] = executionItems.map((item) => ({
    key: item.nodeId,
    label: (
      <div className={styles.executionLabel}>
        <span className={styles.executionName}>{item.nodeId}</span>
        <span className={styles.executionSummary}>{getExecutionSummary(item)}</span>
      </div>
    ),
    extra: getStatusTag(item.status),
    children: (
      <div className={styles.executionDetail}>
        {item.output ? (
          <pre className={styles.outputBlock}>{formatOutput(item.output)}</pre>
        ) : null}
        {item.error ? (
          <Typography.Text type="danger">{item.error}</Typography.Text>
        ) : null}
      </div>
    ),
  }));

  return (
    <PageSectionCard title="调试运行" className={styles.sideCard}>
      <Space direction="vertical" size={12} className={styles.fullWidth}>
        <div className={styles.runSection}>
          <Typography.Text strong>输入参数</Typography.Text>
        </div>
        <Input.TextArea
          rows={5}
          value={inputsText}
          disabled={running}
          onChange={(event) => setInputsText(event.target.value)}
        />
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => void handleRun()}
            loading={running}
          >
            运行
          </Button>
          <Button onClick={handleStop} disabled={!running}>
            停止
          </Button>
          <Button onClick={props.onClear} disabled={running}>
            清除
          </Button>
        </Space>
        <div className={styles.runOverview}>
          <span>{running ? "运行中" : props.finalResult ? "运行完成" : "待运行"}</span>
          <span>{successCount} 成功</span>
          <span>{skippedCount} 跳过</span>
          <span>{failedCount} 失败</span>
        </div>
        {props.finalResult ? (
          <div className={styles.finalOutput}>
            <Typography.Text strong>最终答案</Typography.Text>
            <Typography.Paragraph className={styles.finalOutputText}>
              {props.finalResult.output || "无输出"}
            </Typography.Paragraph>
          </div>
        ) : null}
        <div className={styles.executionList}>
          {executionItems.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行结果" />
          ) : (
            <Collapse
              size="small"
              ghost
              items={collapseItems}
              className={styles.executionCollapse}
            />
          )}
        </div>
      </Space>
    </PageSectionCard>
  );
}

function WorkflowPageContent() {
  const queryClient = useQueryClient();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const [flowNodes, setFlowNodes] = useState<WorkflowFlowNode[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [executions, setExecutions] = useState<
    Record<string, WorkflowNodeExecution>
  >({});
  const [finalResult, setFinalResult] = useState<WorkflowRunFinal | null>(null);

  const workflowQuery = useQuery({
    queryKey: queryKeys.workflows.current(currentKnowledgeBaseId),
    queryFn: () => getCurrentWorkflow(currentKnowledgeBaseId),
    enabled: currentKnowledgeBaseId.length > 0,
  });

  useEffect(() => {
    const workflow = workflowQuery.data;
    if (!workflow) {
      setFlowNodes([]);
      setFlowEdges([]);
      return;
    }
    setFlowNodes(toFlowNodes(workflow.nodes));
    setFlowEdges(toFlowEdges(workflow.edges));
    setExecutions({});
    setFinalResult(null);
  }, [workflowQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (workflow: WorkflowRecord) =>
      updateWorkflow(workflow.id, {
        nodes: toWorkflowNodes(flowNodes),
        edges: toWorkflowEdges(flowEdges),
      }),
    onSuccess: async (workflow) => {
      await queryClient.setQueryData(
        queryKeys.workflows.current(workflow.knowledgeBaseId),
        workflow,
      );
      message.success("工作流已保存。");
    },
    onError: () => {
      message.error("工作流保存失败。");
    },
  });

  const selectedNode = useMemo(
    () => flowNodes.find((node) => node.id === selectedNodeId) ?? null,
    [flowNodes, selectedNodeId],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      setFlowNodes((current) =>
        applyNodeChanges(changes, current) as WorkflowFlowNode[],
      );
    },
    [],
  );

  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setFlowEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    setFlowEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `${connection.source}-${connection.target}-${Date.now()}`,
        },
        current,
      ),
    );
  }, []);

  const handleUpdateNodeData = useCallback(
    (nodeId: string, data: WorkflowNodeData) => {
      setFlowNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...data,
                  executionStatus: node.data.executionStatus,
                },
              }
            : node,
        ),
      );
    },
    [],
  );

  const clearRunState = useCallback(() => {
    setExecutions({});
    setFinalResult(null);
    setFlowNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          executionStatus: undefined,
        },
      })),
    );
  }, []);

  const handleRunEvent = useCallback((event: WorkflowStreamEvent) => {
    if (event.event === "node_status") {
      setExecutions((current) => ({
        ...current,
        [event.data.nodeId]: event.data,
      }));
      setFlowNodes((current) =>
        current.map((node) =>
          node.id === event.data.nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  executionStatus: event.data.status,
                },
              }
            : node,
        ),
      );
      return;
    }
    if (event.event === "final") {
      setFinalResult(event.data);
      return;
    }
    message.error(event.data.message);
  }, []);

  if (currentKnowledgeBaseId.length === 0) {
    return (
      <div className={styles.pageStack}>
        <Typography.Title level={4} className={styles.pageTitle}>
          工作流
        </Typography.Title>
        <Alert type="info" showIcon message="请先选择知识库。" />
      </div>
    );
  }

  if (workflowQuery.isLoading) {
    return (
      <div className={styles.centerState}>
        <Spin size="large" />
      </div>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <div className={styles.pageStack}>
        <Typography.Title level={4} className={styles.pageTitle}>
          工作流
        </Typography.Title>
        <Alert type="error" showIcon message="工作流加载失败。" />
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <div className={styles.pageHeader}>
        <div>
          <Typography.Title level={4} className={styles.pageTitle}>
            工作流
          </Typography.Title>
          <Typography.Text type="secondary">
            当前知识库的默认 RAG 编排，调试运行不会写入聊天记录。
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saveMutation.isPending}
          onClick={() => void saveMutation.mutateAsync(workflowQuery.data)}
        >
          保存
        </Button>
      </div>

      <div className={styles.workspace}>
        <div className={styles.leftRail}>
          <NodePanel />
        </div>
        <PageSectionCard title="画布" className={styles.canvasCard}>
          <WorkflowCanvasSurface
            flowNodes={flowNodes}
            flowEdges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onSelectNode={setSelectedNodeId}
            onAddNode={(node) => setFlowNodes((current) => [...current, node])}
          />
        </PageSectionCard>
        <div className={styles.rightRail}>
          <ConfigPanel
            selectedNode={selectedNode}
            onUpdateNodeData={handleUpdateNodeData}
          />
          <RunPanel
            workflowId={workflowQuery.data.id}
            executions={executions}
            finalResult={finalResult}
            onRunEvent={handleRunEvent}
            onClear={clearRunState}
          />
        </div>
      </div>
    </div>
  );
}

export function WorkflowPage() {
  return (
    <ReactFlowProvider>
      <WorkflowPageContent />
    </ReactFlowProvider>
  );
}
