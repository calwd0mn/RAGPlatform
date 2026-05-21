import { BadRequestException, Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { RagCitation } from '../../rag/interfaces/rag-citation.interface';
import {
  WorkflowRagAnswerResult,
  WorkflowRagRetrievalResult,
  RagService,
} from '../../rag/rag.service';
import type { RetrievedChunk } from '../../rag/interfaces/retrieved-chunk.interface';
import {
  WorkflowLlmOutput,
  WorkflowConditionItem,
  WorkflowEdge,
  WorkflowExecutionContext,
  WorkflowInputValue,
  WorkflowNode,
  WorkflowNodeOutput,
  WorkflowOutputNodeOutput,
  WorkflowQueryRewriteOutput,
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
    const incomingMap = this.buildIncomingMap(nodes, edges);
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
          nodeId,
          userId: input.userId,
          knowledgeBaseId: workflow.knowledgeBaseId.toString(),
          node,
          inputs: input.inputs,
          context,
          incomingNodeIds: incomingMap.get(nodeId) ?? [],
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
    nodeId: string;
    userId: string;
    knowledgeBaseId: string;
    node: WorkflowNode;
    inputs: WorkflowRunInputs;
    context: WorkflowExecutionContext;
    incomingNodeIds: string[];
  }): Promise<WorkflowNodeOutput> {
    switch (input.node.type) {
      case 'start':
        return { started: true };
      case 'userInput':
        return this.executeUserInput(input.node, input.inputs);
      case 'rag':
        return this.executeRagNode(input);
      case 'llm':
        return this.executeLlmNode(input.node, input.context, input.incomingNodeIds);
      case 'queryRewrite':
        return this.executeQueryRewriteNode(input.node, input.context);
      case 'vectorRetrieve':
        return this.executeVectorRetrieveNode(input);
      case 'bm25Retrieve':
        return this.executeBm25RetrieveNode(input);
      case 'mergeResults':
        return this.executeMergeResultsNode(input.node, input.context, input.incomingNodeIds);
      case 'rerank':
        return this.executeRerankNode(input.node, input.context, input.incomingNodeIds);
      case 'answer':
        return this.executeAnswerNode(input);
      case 'condition':
        return this.executeConditionNode(input.node, input.context);
      case 'output':
        return this.executeOutputNode(
          input.node,
          input.context,
          input.incomingNodeIds,
        );
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

  private async executeQueryRewriteNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
  ): Promise<WorkflowQueryRewriteOutput> {
    if (node.data.nodeType !== 'queryRewrite') {
      throw new BadRequestException('Invalid query rewrite node data');
    }

    const query = this.resolveTemplate(node.data.query, context);
    return this.ragService.rewriteQueryForWorkflow({ query });
  }

  private async executeLlmNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    incomingNodeIds: string[],
  ): Promise<WorkflowLlmOutput> {
    if (node.data.nodeType !== 'llm') {
      throw new BadRequestException('Invalid LLM node data');
    }

    const retrievalOutputs = this.findRetrievalOutputsFromInputs(
      context,
      incomingNodeIds,
    );
    const latestRetrieval = retrievalOutputs.at(-1);

    return this.ragService.invokeLlmForWorkflow({
      systemPrompt: this.resolveTemplate(node.data.systemPrompt, context),
      userPrompt: this.resolveTemplate(node.data.userPromptTemplate, context),
      outputMode: node.data.outputMode,
      citations: latestRetrieval?.citations ?? [],
      fallbackText: latestRetrieval
        ? this.ragService.buildWorkflowAnswerFallback(latestRetrieval.chunks)
        : undefined,
    });
  }

  private async executeVectorRetrieveNode(input: {
    userId: string;
    knowledgeBaseId: string;
    node: WorkflowNode;
    context: WorkflowExecutionContext;
  }): Promise<WorkflowRagOutput> {
    if (input.node.data.nodeType !== 'vectorRetrieve') {
      throw new BadRequestException('Invalid vector retrieve node data');
    }

    const query = this.resolveTemplate(input.node.data.query, input.context);
    const retrieval = await this.ragService.retrieveForWorkflow({
      userId: input.userId,
      knowledgeBaseId: input.knowledgeBaseId,
      query,
      topK: input.node.data.topK,
    });
    return this.toRagOutput(retrieval);
  }

  private async executeBm25RetrieveNode(input: {
    userId: string;
    knowledgeBaseId: string;
    node: WorkflowNode;
    context: WorkflowExecutionContext;
  }): Promise<WorkflowRagOutput> {
    if (input.node.data.nodeType !== 'bm25Retrieve') {
      throw new BadRequestException('Invalid BM25 retrieve node data');
    }

    const query = this.resolveTemplate(input.node.data.query, input.context);
    const retrieval = await this.ragService.retrieveBm25ForWorkflow({
      userId: input.userId,
      knowledgeBaseId: input.knowledgeBaseId,
      query,
      topK: input.node.data.topK,
    });
    return this.toRagOutput(retrieval);
  }

  private executeMergeResultsNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    incomingNodeIds: string[],
  ): WorkflowRagOutput {
    if (node.data.nodeType !== 'mergeResults') {
      throw new BadRequestException('Invalid merge results node data');
    }

    const retrievalOutputs = this.findRetrievalOutputsFromInputs(
      context,
      incomingNodeIds,
    );
    const mergedChunks = this.mergeChunksByBestScore(
      retrievalOutputs.flatMap((output) => output.chunks),
    ).slice(0, node.data.resultLimit);
    const lastRetrieval = retrievalOutputs.at(-1);

    return {
      query: lastRetrieval?.query ?? '',
      topK: node.data.resultLimit,
      retrievedCount: mergedChunks.length,
      retrievalProvider: 'merged',
      chunks: mergedChunks,
      citations: this.ragService.mapChunksToCitations(mergedChunks),
    };
  }

  private executeRerankNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    incomingNodeIds: string[],
  ): WorkflowRagOutput {
    if (node.data.nodeType !== 'rerank') {
      throw new BadRequestException('Invalid rerank node data');
    }

    const retrievalOutputs = this.findRetrievalOutputsFromInputs(
      context,
      incomingNodeIds,
    );
    const latestRetrieval = retrievalOutputs.at(-1);
    if (!latestRetrieval) {
      return {
        query: this.resolveTemplate(node.data.query, context),
        topK: node.data.topK,
        retrievedCount: 0,
        retrievalProvider: 'rerank',
        chunks: [],
        citations: [],
      };
    }

    const query = this.resolveTemplate(node.data.query, context);
    const reranked = this.ragService.rerankForWorkflow({
      query,
      chunks: latestRetrieval.chunks,
      topK: node.data.topK,
      retrievalProvider: 'rerank',
    });

    return this.toRagOutput(reranked);
  }

  private async executeAnswerNode(input: {
    knowledgeBaseId: string;
    node: WorkflowNode;
    context: WorkflowExecutionContext;
    incomingNodeIds: string[];
  }): Promise<WorkflowOutputNodeOutput> {
    if (input.node.data.nodeType !== 'answer') {
      throw new BadRequestException('Invalid answer node data');
    }

    const retrievalOutputs = this.findRetrievalOutputsFromInputs(
      input.context,
      input.incomingNodeIds,
    );
    const latestRetrieval = retrievalOutputs.at(-1);
    const question = this.resolveTemplate(input.node.data.question, input.context);

    if (!latestRetrieval) {
      return {
        finalOutput: '根据当前已检索到的信息无法确定。',
        citations: [],
      };
    }

    const answer: WorkflowRagAnswerResult = await this.ragService.answerWorkflow({
      knowledgeBaseId: input.knowledgeBaseId,
      query: question.trim().length > 0 ? question : latestRetrieval.query,
      topK: latestRetrieval.topK,
      chunks: latestRetrieval.chunks,
      retrievalProvider: latestRetrieval.retrievalProvider,
    });

    return {
      finalOutput: answer.answer,
      citations: answer.citations,
    };
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

  private executeOutputNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    incomingNodeIds: string[],
  ): WorkflowOutputNodeOutput {
    if (node.data.nodeType !== 'output') {
      throw new BadRequestException('Invalid output node data');
    }

    return {
      finalOutput: this.resolveTemplate(node.data.outputValue, context),
      citations: this.findCitationsFromInputs(context, incomingNodeIds),
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

  private buildIncomingMap(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ): Map<string, string[]> {
    const incomingMap = new Map<string, string[]>();
    nodes.forEach((node) => {
      incomingMap.set(node.id, []);
    });
    edges.forEach((edge) => {
      incomingMap.get(edge.target)?.push(edge.source);
    });
    return incomingMap;
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

  private findRetrievalOutputsFromInputs(
    context: WorkflowExecutionContext,
    incomingNodeIds: string[],
  ): WorkflowRagOutput[] {
    return incomingNodeIds
      .map((nodeId) => context[nodeId])
      .filter((output): output is WorkflowRagOutput => this.isRagOutput(output));
  }

  private findCitationsFromInputs(
    context: WorkflowExecutionContext,
    incomingNodeIds: string[],
  ): RagCitation[] {
    for (const nodeId of [...incomingNodeIds].reverse()) {
      const output = context[nodeId];
      if (this.isAnswerLikeOutput(output)) {
        return output.citations;
      }
      if (this.isLlmOutput(output) && output.citations.length > 0) {
        return output.citations;
      }
      if (this.isRagOutput(output)) {
        return output.citations;
      }
    }

    return [];
  }

  private mergeChunksByBestScore(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const chunkMap = new Map<string, RetrievedChunk>();

    chunks.forEach((chunk) => {
      const existingChunk = chunkMap.get(chunk.chunkId);
      if (!existingChunk || existingChunk.score < chunk.score) {
        chunkMap.set(chunk.chunkId, chunk);
      }
    });

    return Array.from(chunkMap.values()).sort((left, right) => right.score - left.score);
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

  private isRagOutput(value: WorkflowNodeOutput | undefined): value is WorkflowRagOutput {
    return Boolean(
      value &&
        this.isRecord(value) &&
        'chunks' in value &&
        'retrievalProvider' in value &&
        'topK' in value,
    );
  }

  private isLlmOutput(value: WorkflowNodeOutput | undefined): value is WorkflowLlmOutput {
    return Boolean(
      value &&
        this.isRecord(value) &&
        'text' in value &&
        'outputMode' in value &&
        'citations' in value,
    );
  }

  private isAnswerLikeOutput(
    value: WorkflowNodeOutput | undefined,
  ): value is WorkflowOutputNodeOutput {
    return Boolean(
      value &&
        this.isRecord(value) &&
        'finalOutput' in value &&
        'citations' in value,
    );
  }

  private resolveFinalOutput(context: WorkflowExecutionContext): string {
    const outputs = Object.values(context).filter((output): output is WorkflowOutputNodeOutput =>
      this.isAnswerLikeOutput(output),
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
