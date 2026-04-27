import { SaveOutlined } from "@ant-design/icons";
import {
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Spin, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { WorkflowCanvasSurface } from "../../components/workflow/WorkflowCanvasSurface";
import { WorkflowConfigPanel } from "../../components/workflow/WorkflowConfigPanel";
import { WorkflowNodePanel } from "../../components/workflow/WorkflowNodePanel";
import { WorkflowRunPanel } from "../../components/workflow/WorkflowRunPanel";
import type { WorkflowFlowNode } from "../../components/workflow/WorkflowNodes";
import styles from "../../components/workflow/WorkflowEditorPanels.module.css";
import {
  toFlowEdges,
  toFlowNodes,
  toWorkflowEdges,
  toWorkflowNodes,
} from "../../components/workflow/workflow-graph-adapters";
import { queryKeys } from "../../constants/queryKeys";
import {
  getCurrentWorkflow,
  updateWorkflow,
} from "../../services/workflows";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type {
  WorkflowNodeData,
  WorkflowNodeExecution,
  WorkflowRecord,
  WorkflowRunFinal,
  WorkflowStreamEvent,
} from "../../types/workflow";
import pageStyles from "./WorkflowPage.module.css";

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
      <div className={pageStyles.pageStack}>
        <Typography.Title level={4} className={pageStyles.pageTitle}>
          工作流
        </Typography.Title>
        <Alert type="info" showIcon message="请先选择知识库。" />
      </div>
    );
  }

  if (workflowQuery.isLoading) {
    return (
      <div className={pageStyles.centerState}>
        <Spin size="large" />
      </div>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <div className={pageStyles.pageStack}>
        <Typography.Title level={4} className={pageStyles.pageTitle}>
          工作流
        </Typography.Title>
        <Alert type="error" showIcon message="工作流加载失败。" />
      </div>
    );
  }

  return (
    <div className={pageStyles.pageStack}>
      <div className={pageStyles.pageHeader}>
        <div>
          <Typography.Title level={4} className={pageStyles.pageTitle}>
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

      <div className={pageStyles.workspace}>
        <div className={pageStyles.leftRail}>
          <WorkflowNodePanel />
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
        <div className={pageStyles.rightRail}>
          <WorkflowConfigPanel
            selectedNode={selectedNode}
            onUpdateNodeData={handleUpdateNodeData}
          />
          <WorkflowRunPanel
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
