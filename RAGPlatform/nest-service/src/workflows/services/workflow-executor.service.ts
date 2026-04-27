import { BadRequestException, Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  WorkflowRagAnswerResult,
  WorkflowRagRetrievalResult,
  RagService,
} from '../../rag/rag.service';
import {
  WorkflowConditionItem,
  WorkflowEdge,
  WorkflowExecutionContext,
  WorkflowInputValue,
  WorkflowNode,
  WorkflowNodeOutput,
  WorkflowOutputNodeOutput,
  WorkflowRagOutput,
  WorkflowRunInputs,
} from '../interfaces/workflow-node.interface';
import { WorkflowsService } from './workflows.service';

export type WorkflowStreamEvent =
  | {
      type: 'node_status';
      data: {
        nodeId: string;
        status: 'running' | 'success' | 'failed' | 'skipped';
        output?: WorkflowNodeOutput;
        error?: string;
      };
    }
  | {
      type: 'final';
      data: {
        output: string;
        context: WorkflowExecutionContext;
      };
    }
  | {
      type: 'error';
      data: {
        message: string;
      };
    };

interface DownstreamEdge {
  target: string;
  sourceHandle?: 'true' | 'false';
}

@Injectable()
export class WorkflowExecutorService {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly ragService: RagService,
  ) {}

  async execute(input: {
    userId: string;
    workflowId: string;
    inputs: WorkflowRunInputs;
    events?: Subject<WorkflowStreamEvent>;
  }): Promise<{ output: string; context: WorkflowExecutionContext }> {
    const workflow = await this.workflowsService.findOwnedDocument(
      input.userId,
      input.workflowId,
    );
    const nodes = workflow.nodes;
    const edges = workflow.edges;
    this.assertAcyclic(nodes, edges);

    const nodeMap = new Map(nodes.map((node): [string, WorkflowNode] => [node.id, node]));
    const adjList = this.buildAdjacency(nodes, edges);
    const runtimeInDegree = this.buildInDegree(nodes, edges);
    const queue = nodes
      .filter((node): boolean => (runtimeInDegree.get(node.id) ?? 0) === 0)
      .map((node): string => node.id);
    const context: WorkflowExecutionContext = {};
    const executed = new Set<string>();
    const skipped = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || executed.has(nodeId) || skipped.has(nodeId)) {
        continue;
      }

      const node = nodeMap.get(nodeId);
      if (!node) {
        throw new BadRequestException('Workflow references a missing node');
      }

      try {
        input.events?.next({
          type: 'node_status',
          data: { nodeId, status: 'running' },
        });
        const output = await this.executeNode({
          userId: input.userId,
          knowledgeBaseId: workflow.knowledgeBaseId.toString(),
          node,
          inputs: input.inputs,
          context,
        });
        context[nodeId] = output;
        executed.add(nodeId);
        input.events?.next({
          type: 'node_status',
          data: { nodeId, status: 'success', output },
        });
        this.activateDownstream({
          node,
          output,
          adjList,
          runtimeInDegree,
          queue,
          skipped,
          events: input.events,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Node failed';
        input.events?.next({
          type: 'node_status',
          data: { nodeId, status: 'failed', error: message },
        });
        throw error;
      }
    }

    const output = this.resolveFinalOutput(context);
    const result = { output, context };
    input.events?.next({ type: 'final', data: result });
    return result;
  }

  private async executeNode(input: {
    userId: string;
    knowledgeBaseId: string;
    node: WorkflowNode;
    inputs: WorkflowRunInputs;
    context: WorkflowExecutionContext;
  }): Promise<WorkflowNodeOutput> {
    switch (input.node.type) {
      case 'start':
        return { started: true };
      case 'userInput':
        return this.executeUserInput(input.node, input.inputs);
      case 'rag':
        return this.executeRagNode(input);
      case 'condition':
        return this.executeConditionNode(input.node, input.context);
      case 'output':
        return this.executeOutputNode(input);
    }
  }

  private executeUserInput(
    node: WorkflowNode,
    inputs: WorkflowRunInputs,
  ): WorkflowNodeOutput {
    if (node.data.nodeType !== 'userInput') {
      throw new BadRequestException('Invalid user input node data');
    }
    const value = inputs[node.data.inputField];
    if (value === undefined) {
      throw new BadRequestException(
        `Missing required input: ${node.data.inputField}`,
      );
    }
    return { field: node.data.inputField, value };
  }

  private async executeRagNode(input: {
    userId: string;
    knowledgeBaseId: string;
    node: WorkflowNode;
    context: WorkflowExecutionContext;
  }): Promise<WorkflowRagOutput> {
    if (input.node.data.nodeType !== 'rag') {
      throw new BadRequestException('Invalid RAG node data');
    }
    const query = this.resolveTemplate(input.node.data.query, input.context);
    const topK = input.node.data.topK;
    const retrieval = await this.ragService.retrieveForWorkflow({
      userId: input.userId,
      knowledgeBaseId: input.knowledgeBaseId,
      query,
      topK,
    });
    return this.toRagOutput(retrieval);
  }

  private executeConditionNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
  ): WorkflowNodeOutput {
    if (node.data.nodeType !== 'condition') {
      throw new BadRequestException('Invalid condition node data');
    }
    const result = node.data.conditions.every(
      (condition): boolean => this.evaluateCondition(condition, context),
    );
    return { result };
  }

  private async executeOutputNode(input: {
    knowledgeBaseId: string;
    node: WorkflowNode;
    context: WorkflowExecutionContext;
  }): Promise<WorkflowOutputNodeOutput> {
    if (input.node.data.nodeType !== 'output') {
      throw new BadRequestException('Invalid output node data');
    }
    const ragOutput = this.findLatestRagOutput(input.context);
    const resolvedOutput = this.resolveTemplate(
      input.node.data.outputValue,
      input.context,
    );

    if (!ragOutput) {
      return { finalOutput: resolvedOutput, citations: [] };
    }

    const answer: WorkflowRagAnswerResult = await this.ragService.answerWorkflow(
      {
        knowledgeBaseId: input.knowledgeBaseId,
        query: resolvedOutput.trim().length > 0 ? resolvedOutput : ragOutput.query,
        topK: ragOutput.topK,
        chunks: ragOutput.chunks,
        retrievalProvider: ragOutput.retrievalProvider,
      },
    );

    return {
      finalOutput: answer.answer,
      citations: answer.citations,
    };
  }

  private activateDownstream(input: {
    node: WorkflowNode;
    output: WorkflowNodeOutput;
    adjList: Map<string, DownstreamEdge[]>;
    runtimeInDegree: Map<string, number>;
    queue: string[];
    skipped: Set<string>;
    events?: Subject<WorkflowStreamEvent>;
  }): void {
    const downstream = input.adjList.get(input.node.id) ?? [];

    if (input.node.type === 'condition') {
      const conditionResult =
        'result' in input.output ? Boolean(input.output.result) : false;
      const activeHandle = conditionResult ? 'true' : 'false';
      const skippedHandle = conditionResult ? 'false' : 'true';

      downstream.forEach((edge): void => {
        if (edge.sourceHandle === activeHandle) {
          this.enqueueWhenReady(edge.target, input.runtimeInDegree, input.queue);
          return;
        }
        if (edge.sourceHandle === skippedHandle) {
          this.skipBranch(edge.target, input.adjList, input.skipped, input.events);
        }
      });
      return;
    }

    downstream.forEach((edge): void => {
      if (!input.skipped.has(edge.target)) {
        this.enqueueWhenReady(edge.target, input.runtimeInDegree, input.queue);
      }
    });
  }

  private enqueueWhenReady(
    nodeId: string,
    runtimeInDegree: Map<string, number>,
    queue: string[],
  ): void {
    const nextDegree = (runtimeInDegree.get(nodeId) ?? 1) - 1;
    runtimeInDegree.set(nodeId, nextDegree);
    if (nextDegree <= 0) {
      queue.push(nodeId);
    }
  }

  private skipBranch(
    nodeId: string,
    adjList: Map<string, DownstreamEdge[]>,
    skipped: Set<string>,
    events?: Subject<WorkflowStreamEvent>,
  ): void {
    if (skipped.has(nodeId)) {
      return;
    }
    skipped.add(nodeId);
    events?.next({
      type: 'node_status',
      data: { nodeId, status: 'skipped' },
    });
    (adjList.get(nodeId) ?? []).forEach((edge): void => {
      this.skipBranch(edge.target, adjList, skipped, events);
    });
  }

  private buildAdjacency(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ): Map<string, DownstreamEdge[]> {
    const adjList = new Map<string, DownstreamEdge[]>();
    nodes.forEach((node): void => {
      adjList.set(node.id, []);
    });
    edges.forEach((edge): void => {
      adjList.get(edge.source)?.push({
        target: edge.target,
        sourceHandle: edge.sourceHandle,
      });
    });
    return adjList;
  }

  private buildInDegree(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ): Map<string, number> {
    const inDegree = new Map<string, number>();
    nodes.forEach((node): void => {
      inDegree.set(node.id, 0);
    });
    edges.forEach((edge): void => {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    });
    return inDegree;
  }

  private assertAcyclic(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const inDegree = this.buildInDegree(nodes, edges);
    const adjList = this.buildAdjacency(nodes, edges);
    const queue = nodes
      .filter((node): boolean => (inDegree.get(node.id) ?? 0) === 0)
      .map((node): string => node.id);
    let visitedCount = 0;

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId) {
        continue;
      }
      visitedCount += 1;
      (adjList.get(nodeId) ?? []).forEach((edge): void => {
        const nextDegree = (inDegree.get(edge.target) ?? 0) - 1;
        inDegree.set(edge.target, nextDegree);
        if (nextDegree === 0) {
          queue.push(edge.target);
        }
      });
    }

    if (visitedCount !== nodes.length) {
      throw new BadRequestException('Cycle detected in workflow graph');
    }
  }

  private evaluateCondition(
    condition: WorkflowConditionItem,
    context: WorkflowExecutionContext,
  ): boolean {
    const leftValue = this.resolvePath(condition.variable, context);
    const rightValue = condition.value;

    switch (condition.operator) {
      case '===':
        return leftValue === rightValue;
      case '!==':
        return leftValue !== rightValue;
      case '>':
        return Number(leftValue) > Number(rightValue);
      case '<':
        return Number(leftValue) < Number(rightValue);
      case '>=':
        return Number(leftValue) >= Number(rightValue);
      case '<=':
        return Number(leftValue) <= Number(rightValue);
      case 'contains':
        return String(leftValue ?? '').includes(String(rightValue));
    }
  }

  private resolveTemplate(
    template: string,
    context: WorkflowExecutionContext,
  ): string {
    return template.replace(/\{\{(.+?)\}\}/g, (match, rawPath): string => {
      if (typeof rawPath !== 'string') {
        return match;
      }
      const value = this.resolvePath(rawPath, context);
      if (value === undefined) {
        return match;
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  private resolvePath(
    templatePath: string,
    context: WorkflowExecutionContext,
  ): WorkflowInputValue | WorkflowNodeOutput | undefined {
    const keys = templatePath.replace(/\{\{|\}\}/g, '').trim().split('.');
    let current: unknown = context;

    for (const key of keys) {
      if (!this.isRecord(current) || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }

    return this.isWorkflowValue(current) ? current : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isWorkflowValue(
    value: unknown,
  ): value is WorkflowInputValue | WorkflowNodeOutput {
    return (
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value) ||
      Array.isArray(value) ||
      this.isRecord(value)
    );
  }

  private findLatestRagOutput(
    context: WorkflowExecutionContext,
  ): WorkflowRagOutput | null {
    const outputs = Object.values(context).filter(
      (output): output is WorkflowRagOutput =>
        'chunks' in output && 'retrievalProvider' in output,
    );
    return outputs.at(-1) ?? null;
  }

  private resolveFinalOutput(context: WorkflowExecutionContext): string {
    const outputs = Object.values(context).filter(
      (output): output is WorkflowOutputNodeOutput => 'finalOutput' in output,
    );
    return outputs.at(-1)?.finalOutput ?? '';
  }

  private toRagOutput(retrieval: WorkflowRagRetrievalResult): WorkflowRagOutput {
    return {
      query: retrieval.query,
      topK: retrieval.topK,
      retrievedCount: retrieval.chunks.length,
      retrievalProvider: retrieval.retrievalProvider,
      chunks: retrieval.chunks,
      citations: retrieval.citations,
    };
  }
}
