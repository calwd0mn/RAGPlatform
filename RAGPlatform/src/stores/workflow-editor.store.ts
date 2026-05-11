import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import type { WorkflowFlowNode } from "../components/workflow/WorkflowNodes";
import {
  toFlowEdges,
  toFlowNodes,
} from "../components/workflow/workflow-graph-adapters";
import type {
  WorkflowNodeData,
  WorkflowNodeExecution,
  WorkflowRecord,
  WorkflowRunFinal,
} from "../types/workflow";

interface WorkflowEditorState {
  // 业务数据
  workflowId: string;
  knowledgeBaseId: string;
  // 编辑态
  flowNodes: WorkflowFlowNode[];
  flowEdges: Edge[];
  selectedNodeId: string;
  // 运行态
  executionStates: Record<string, WorkflowNodeExecution>;
  finalResult: WorkflowRunFinal | null;

  setWorkflow: (workflow: WorkflowRecord) => void;
  resetWorkflow: () => void;
  setFlowNodes: (nodes: WorkflowFlowNode[]) => void;
  setFlowEdges: (edges: Edge[]) => void;
  applyWorkflowNodeChanges: (
    changes: NodeChange<WorkflowFlowNode>[],
  ) => void;
  applyWorkflowEdgeChanges: (changes: EdgeChange<Edge>[]) => void;
  connectNodes: (connection: Connection) => void;
  addNode: (node: WorkflowFlowNode) => void;
  selectNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: WorkflowNodeData) => void;
  setNodeExecution: (execution: WorkflowNodeExecution) => void;
  setFinalResult: (result: WorkflowRunFinal) => void;
  clearRunState: () => void;
}

const emptyWorkflowState = {
  workflowId: "",
  knowledgeBaseId: "",
  flowNodes: [],
  flowEdges: [],
  selectedNodeId: "",
  executionStates: {},
  finalResult: null,
} satisfies Pick<
  WorkflowEditorState,
  | "workflowId"
  | "knowledgeBaseId"
  | "flowNodes"
  | "flowEdges"
  | "selectedNodeId"
  | "executionStates"
  | "finalResult"
>;

// 创建仓库
export const useWorkflowEditorStore = create<WorkflowEditorState>((set) => ({
  ...emptyWorkflowState,
  // 加载一个工作流到编辑器中
  setWorkflow: (workflow) =>
    set({
      // 标识
      workflowId: workflow.id,
      knowledgeBaseId: workflow.knowledgeBaseId,
      // 后端转换
      flowNodes: toFlowNodes(workflow.nodes),
      flowEdges: toFlowEdges(workflow.edges),
      // 清空选择、运行态
      selectedNodeId: "",
      executionStates: {},
      finalResult: null,
    }),
  resetWorkflow: () => set(emptyWorkflowState),
  setFlowNodes: (nodes) => set({ flowNodes: nodes }),
  setFlowEdges: (edges) => set({ flowEdges: edges }),
  applyWorkflowNodeChanges: (changes) =>
    set((state) => ({
      flowNodes: applyNodeChanges(
        changes,
        state.flowNodes,
      ) as WorkflowFlowNode[],
    })),
  applyWorkflowEdgeChanges: (changes) =>
    set((state) => ({
      flowEdges: applyEdgeChanges(changes, state.flowEdges),
    })),
  connectNodes: (connection) =>
    set((state) => ({
      flowEdges: addEdge(
        {
          ...connection,
          id: `${connection.source}-${connection.target}-${Date.now()}`,
        },
        state.flowEdges,
      ),
    })),
  addNode: (node) =>
    set((state) => ({
      flowNodes: [...state.flowNodes, node],
    })),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  updateNodeData: (nodeId, data) =>
    set((state) => ({
      flowNodes: state.flowNodes.map((node) =>
        node.id === nodeId ? { ...node, data } : node,
      ),
    })),
  setNodeExecution: (execution) =>
    set((state) => ({
      executionStates: {
        ...state.executionStates,
        [execution.nodeId]: execution,
      },
    })),
  setFinalResult: (result) => set({ finalResult: result }),
  clearRunState: () =>
    set({
      executionStates: {},
      finalResult: null,
    }),
}));
