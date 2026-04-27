import type { Edge } from "@xyflow/react";
import type {
  WorkflowEdge,
  WorkflowNode,
} from "../../types/workflow";
import type { WorkflowFlowNode } from "./WorkflowNodes";

export function toFlowNodes(nodes: WorkflowNode[]): WorkflowFlowNode[] {
  return nodes.map(
    (node): WorkflowFlowNode => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }),
  );
}

export function toWorkflowNodes(nodes: WorkflowFlowNode[]): WorkflowNode[] {
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

export function toFlowEdges(edges: WorkflowEdge[]): Edge[] {
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

export function toWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
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

