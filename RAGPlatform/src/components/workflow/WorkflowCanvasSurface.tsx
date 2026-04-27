import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef } from "react";
import { useWorkflowEditorStore } from "../../stores/workflow-editor.store";
import type { WorkflowNodeType } from "../../types/workflow";
import {
  createWorkflowNodeData,
  WORKFLOW_NODE_CATALOG,
  workflowReactNodeTypes,
} from "./workflow-node-catalog";
import styles from "./WorkflowEditorPanels.module.css";

export function WorkflowCanvasSurface() {
  const { screenToFlowPosition } = useReactFlow();
  const flowNodes = useWorkflowEditorStore((state) => state.flowNodes);
  const flowEdges = useWorkflowEditorStore((state) => state.flowEdges);
  const applyWorkflowNodeChanges = useWorkflowEditorStore(
    (state) => state.applyWorkflowNodeChanges,
  );
  const applyWorkflowEdgeChanges = useWorkflowEditorStore(
    (state) => state.applyWorkflowEdgeChanges,
  );
  const connectNodes = useWorkflowEditorStore((state) => state.connectNodes);
  const selectNode = useWorkflowEditorStore((state) => state.selectNode);
  const addNode = useWorkflowEditorStore((state) => state.addNode);
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
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={workflowReactNodeTypes}
        onNodesChange={applyWorkflowNodeChanges}
        onEdgesChange={applyWorkflowEdgeChanges}
        onConnect={connectNodes}
        onNodeClick={(_event, node) => selectNode(node.id)}
        fitView
      >
        <Background gap={18} color="#e5e7eb" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
