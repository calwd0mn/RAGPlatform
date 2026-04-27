import { SaveOutlined } from "@ant-design/icons";
import { ReactFlowProvider } from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Spin, Typography, message } from "antd";
import { useEffect } from "react";
import { PageSectionCard } from "../../components/common/PageSectionCard";
import { WorkflowCanvasSurface } from "../../components/workflow/WorkflowCanvasSurface";
import { WorkflowConfigPanel } from "../../components/workflow/WorkflowConfigPanel";
import { WorkflowNodePanel } from "../../components/workflow/WorkflowNodePanel";
import { WorkflowRunPanel } from "../../components/workflow/WorkflowRunPanel";
import styles from "../../components/workflow/WorkflowEditorPanels.module.css";
import {
  toWorkflowEdges,
  toWorkflowNodes,
} from "../../components/workflow/workflow-graph-adapters";
import { queryKeys } from "../../constants/queryKeys";
import {
  getCurrentWorkflow,
  updateWorkflow,
} from "../../services/workflows";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import { useWorkflowEditorStore } from "../../stores/workflow-editor.store";
import type { WorkflowRecord } from "../../types/workflow";
import pageStyles from "./WorkflowPage.module.css";

function WorkflowPageContent() {
  const queryClient = useQueryClient();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const setWorkflow = useWorkflowEditorStore((state) => state.setWorkflow);
  const resetWorkflow = useWorkflowEditorStore((state) => state.resetWorkflow);

  const workflowQuery = useQuery({
    queryKey: queryKeys.workflows.current(currentKnowledgeBaseId),
    queryFn: () => getCurrentWorkflow(currentKnowledgeBaseId),
    enabled: currentKnowledgeBaseId.length > 0,
  });

  useEffect(() => {
    if (currentKnowledgeBaseId.length === 0 || workflowQuery.isError) {
      resetWorkflow();
      return;
    }
    if (workflowQuery.data) {
      setWorkflow(workflowQuery.data);
    }
  }, [
    currentKnowledgeBaseId,
    resetWorkflow,
    setWorkflow,
    workflowQuery.data,
    workflowQuery.isError,
  ]);

  const saveMutation = useMutation({
    mutationFn: (workflow: WorkflowRecord) => {
      const { flowNodes, flowEdges } = useWorkflowEditorStore.getState();
      return updateWorkflow(workflow.id, {
        nodes: toWorkflowNodes(flowNodes),
        edges: toWorkflowEdges(flowEdges),
      });
    },
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
          <WorkflowCanvasSurface />
        </PageSectionCard>
        <div className={pageStyles.rightRail}>
          <WorkflowConfigPanel />
          <WorkflowRunPanel />
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
