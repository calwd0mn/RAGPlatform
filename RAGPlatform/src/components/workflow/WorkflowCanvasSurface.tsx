import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useRef } from "react";
import type { WorkflowNodeType } from "../../types/workflow";
import type { WorkflowFlowNode } from "./WorkflowNodes";
import {
  createWorkflowNodeData,
  WORKFLOW_NODE_CATALOG,
  workflowReactNodeTypes,
} from "./workflow-node-catalog";
import styles from "./WorkflowEditorPanels.module.css";

interface WorkflowCanvasSurfaceProps {
  flowNodes: WorkflowFlowNode[];
  flowEdges: Edge[];
  onNodesChange: (changes: NodeChange<WorkflowFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectNode: (nodeId: string) => void;
  onAddNode: (node: WorkflowFlowNode) => void;
}

export function WorkflowCanvasSurface(props: WorkflowCanvasSurfaceProps) {
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
      if (!WORKFLOW_NODE_CATALOG.some((item) => item.type === type)) {
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
        data: createWorkflowNodeData(type),
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
        nodeTypes={workflowReactNodeTypes}
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

