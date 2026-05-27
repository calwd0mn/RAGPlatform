import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { useWorkflowEditorStore } from "../../stores/workflow-editor.store";
import type { WorkflowNodeType } from "../../types/workflow";
import type { WorkflowFlowNode } from "./WorkflowNodes";
import {
  createWorkflowNodeData,
  WORKFLOW_NODE_CATALOG,
  workflowReactNodeTypes,
} from "./workflow-node-catalog";
import styles from "./WorkflowEditorPanels.module.css";

export function WorkflowCanvasSurface() {
  const { screenToFlowPosition, setNodes, getNodes } =
    useReactFlow<WorkflowFlowNode>();
  const flowNodes = useWorkflowEditorStore((state) => state.flowNodes);
  const flowEdges = useWorkflowEditorStore((state) => state.flowEdges);
  const applyWorkflowEdgeChanges = useWorkflowEditorStore(
    (state) => state.applyWorkflowEdgeChanges,
  );
  const connectNodes = useWorkflowEditorStore((state) => state.connectNodes);
  const selectNode = useWorkflowEditorStore((state) => state.selectNode);
  const addNode = useWorkflowEditorStore((state) => state.addNode);
  const setFlowNodes = useWorkflowEditorStore((state) => state.setFlowNodes);
  const canvasRef = useRef<HTMLDivElement>(null);
  const reactFlowReadyRef = useRef(false);

  useEffect(() => {
    if (!reactFlowReadyRef.current) {
      return;
    }
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  const handleInit = useCallback(
    (instance: ReactFlowInstance<WorkflowFlowNode>) => {
      reactFlowReadyRef.current = true;
      instance.setNodes(flowNodes);
    },
    [flowNodes],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  // 新增节点
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/workflow-node",
      ) as WorkflowNodeType;
      if (!WORKFLOW_NODE_CATALOG.some((item) => item.type === type)) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode({
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: createWorkflowNodeData(type),
      });
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <div
      className={styles.canvas}
      ref={canvasRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        defaultNodes={flowNodes}
        edges={flowEdges}
        nodeTypes={workflowReactNodeTypes}
        onInit={handleInit}
        onEdgesChange={applyWorkflowEdgeChanges}
        onConnect={connectNodes}
        onNodeClick={(_event, node) => selectNode(node.id)}
        onNodeDragStop={() => setFlowNodes(getNodes())}
        onNodesDelete={() => setFlowNodes(getNodes())}
        fitView
      >
        <Background gap={18} color="#e5e7eb" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
