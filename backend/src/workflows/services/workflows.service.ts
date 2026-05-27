import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBasesService } from '../../knowledge-bases/knowledge-bases.service';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import {
  WorkflowEdge,
  WorkflowConditionOperator,
  WorkflowNodeData,
  WorkflowNode,
  WorkflowResponse,
} from '../interfaces/workflow-node.interface';
import { Workflow, WorkflowDocument } from '../schemas/workflow.schema';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectModel(Workflow.name)
    private readonly workflowModel: Model<WorkflowDocument>,
    private readonly knowledgeBasesService: KnowledgeBasesService,
  ) {}

  async findOrCreateCurrent(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<WorkflowResponse> {
    await this.knowledgeBasesService.assertOwnedKnowledgeBase(
      userId,
      knowledgeBaseId,
    );

    const normalizedUserId = this.toObjectId(userId);
    const normalizedKnowledgeBaseId = this.toObjectId(knowledgeBaseId);
    const existing = await this.workflowModel
      .findOne({
        userId: normalizedUserId,
        knowledgeBaseId: normalizedKnowledgeBaseId,
      })
      .exec();

    if (existing) {
      return this.toResponse(existing);
    }

    const created = await this.workflowModel.create({
      userId: normalizedUserId,
      knowledgeBaseId: normalizedKnowledgeBaseId,
      nodes: this.createDefaultNodes(),
      edges: this.createDefaultEdges(),
    });

    return this.toResponse(created);
  }

  async update(
    userId: string,
    workflowId: string,
    dto: UpdateWorkflowDto,
  ): Promise<WorkflowResponse> {
    const nodes = dto.nodes.map(
      (node): WorkflowNode => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: this.normalizeNodeData(node.data),
      }),
    );
    const edges = dto.edges.map(
      (edge): WorkflowEdge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
      }),
    );
    this.assertValidGraph(nodes, edges);
    const normalizedUserId = this.toObjectId(userId);
    const normalizedWorkflowId = this.toObjectId(workflowId);
    const updated = await this.workflowModel
      .findOneAndUpdate(
        { _id: normalizedWorkflowId, userId: normalizedUserId },
        {
          nodes,
          edges,
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Workflow not found');
    }

    return this.toResponse(updated);
  }

  async findOwnedDocument(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowDocument> {
    const workflow = await this.workflowModel
      .findOne({
        _id: this.toObjectId(workflowId),
        userId: this.toObjectId(userId),
      })
      .exec();

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  toResponse(row: WorkflowDocument): WorkflowResponse {
    return {
      id: row.id,
      userId: row.userId.toString(),
      knowledgeBaseId: row.knowledgeBaseId.toString(),
      nodes: row.nodes,
      edges: row.edges,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertValidGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const nodeIds = new Set(nodes.map((node): string => node.id));
    if (nodeIds.size !== nodes.length) {
      throw new BadRequestException('Workflow node ids must be unique');
    }

    for (const node of nodes) {
      if (node.type !== node.data.nodeType) {
        throw new BadRequestException('Workflow node type mismatch');
      }
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new BadRequestException('Workflow edge references missing node');
      }
      const sourceNode = nodes.find((node): boolean => node.id === edge.source);
      if (sourceNode?.type === 'condition' && !edge.sourceHandle) {
        throw new BadRequestException(
          'Condition edges must use true or false handles',
        );
      }
    }
  }

  private normalizeNodeData(data: {
    label: string;
    nodeType: string;
    inputField?: string;
    query?: string;
    systemPrompt?: string;
    userPromptTemplate?: string;
    outputMode?: 'text' | 'json';
    topK?: number;
    resultLimit?: number;
    conditions?: Array<{
      variable: string;
      operator: string;
      value: string | number | boolean;
    }>;
    question?: string;
    outputValue?: string;
  }): WorkflowNodeData {
    if (data.nodeType === 'start') {
      return { nodeType: 'start', label: data.label };
    }
    if (data.nodeType === 'userInput') {
      if (!data.inputField) {
        throw new BadRequestException('User input node requires inputField');
      }
      return {
        nodeType: 'userInput',
        label: data.label,
        inputField: data.inputField,
      };
    }
    if (data.nodeType === 'rag') {
      if (!data.query) {
        throw new BadRequestException('RAG node requires query');
      }
      return {
        nodeType: 'rag',
        label: data.label,
        query: data.query,
        topK: data.topK ?? 5,
      };
    }
    if (data.nodeType === 'llm') {
      if (!data.systemPrompt || !data.userPromptTemplate) {
        throw new BadRequestException(
          'LLM node requires systemPrompt and userPromptTemplate',
        );
      }
      return {
        nodeType: 'llm',
        label: data.label,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        outputMode: data.outputMode ?? 'text',
      };
    }
    if (data.nodeType === 'queryRewrite') {
      if (!data.query) {
        throw new BadRequestException('Query rewrite node requires query');
      }
      return {
        nodeType: 'queryRewrite',
        label: data.label,
        query: data.query,
      };
    }
    if (data.nodeType === 'vectorRetrieve') {
      if (!data.query) {
        throw new BadRequestException('Vector retrieve node requires query');
      }
      return {
        nodeType: 'vectorRetrieve',
        label: data.label,
        query: data.query,
        topK: data.topK ?? 5,
      };
    }
    if (data.nodeType === 'bm25Retrieve') {
      if (!data.query) {
        throw new BadRequestException('BM25 retrieve node requires query');
      }
      return {
        nodeType: 'bm25Retrieve',
        label: data.label,
        query: data.query,
        topK: data.topK ?? 5,
      };
    }
    if (data.nodeType === 'mergeResults') {
      return {
        nodeType: 'mergeResults',
        label: data.label,
        resultLimit: data.resultLimit ?? 8,
      };
    }
    if (data.nodeType === 'rerank') {
      if (!data.query) {
        throw new BadRequestException('Rerank node requires query');
      }
      return {
        nodeType: 'rerank',
        label: data.label,
        query: data.query,
        topK: data.topK ?? 5,
      };
    }
    if (data.nodeType === 'answer') {
      if (!data.question) {
        throw new BadRequestException('Answer node requires question');
      }
      return {
        nodeType: 'answer',
        label: data.label,
        question: data.question,
      };
    }
    if (data.nodeType === 'condition') {
      const conditions = (data.conditions ?? []).map((condition) => {
        if (!this.isConditionOperator(condition.operator)) {
          throw new BadRequestException('Unsupported condition operator');
        }
        return {
          variable: condition.variable,
          operator: condition.operator,
          value: condition.value,
        };
      });
      return {
        nodeType: 'condition',
        label: data.label,
        conditions,
      };
    }
    if (data.nodeType === 'output') {
      return {
        nodeType: 'output',
        label: data.label,
        outputValue: data.outputValue ?? '',
      };
    }
    throw new BadRequestException('Unsupported workflow node type');
  }

  private isConditionOperator(
    value: string,
  ): value is WorkflowConditionOperator {
    return ['===', '!==', '>', '<', '>=', '<=', 'contains'].includes(value);
  }

  private createDefaultNodes(): WorkflowNode[] {
    return [
      {
        id: 'start',
        type: 'start',
        position: { x: 80, y: 160 },
        data: { nodeType: 'start', label: '开始' },
      },
      {
        id: 'user_input',
        type: 'userInput',
        position: { x: 340, y: 160 },
        data: {
          nodeType: 'userInput',
          label: '用户输入',
          inputField: 'question',
        },
      },
      {
        id: 'llm_rewrite',
        type: 'llm',
        position: { x: 620, y: 160 },
        data: {
          nodeType: 'llm',
          label: '问题优化',
          systemPrompt: '你是一个严谨的检索助手。',
          userPromptTemplate:
            '请把下面的问题改写成更适合检索的查询，保留原意，不要回答问题，只输出改写后的问题：\n{{user_input.value}}',
          outputMode: 'text',
        },
      },
      {
        id: 'vector_retrieve',
        type: 'vectorRetrieve',
        position: { x: 900, y: 80 },
        data: {
          nodeType: 'vectorRetrieve',
          label: '向量检索',
          query: '{{llm_rewrite.text}}',
          topK: 5,
        },
      },
      {
        id: 'bm25_retrieve',
        type: 'bm25Retrieve',
        position: { x: 900, y: 250 },
        data: {
          nodeType: 'bm25Retrieve',
          label: 'BM25 检索',
          query: '{{llm_rewrite.text}}',
          topK: 5,
        },
      },
      {
        id: 'merge_results',
        type: 'mergeResults',
        position: { x: 1180, y: 160 },
        data: {
          nodeType: 'mergeResults',
          label: '结果合并',
          resultLimit: 8,
        },
      },
      {
        id: 'rerank',
        type: 'rerank',
        position: { x: 1460, y: 160 },
        data: {
          nodeType: 'rerank',
          label: '结果重排',
          query: '{{llm_rewrite.text}}',
          topK: 5,
        },
      },
      {
        id: 'llm_answer',
        type: 'llm',
        position: { x: 1740, y: 160 },
        data: {
          nodeType: 'llm',
          label: '答案生成',
          systemPrompt:
            '你是一个严谨的知识库问答助手。请仅基于提供的检索内容回答问题；如果信息不足，明确说明无法确定；不要编造。',
          userPromptTemplate:
            '用户问题：{{user_input.value}}\n\n检索结果：\n{{rerank.chunks}}\n\n请基于以上检索结果，用中文给出准确、简洁的回答。',
          outputMode: 'text',
        },
      },
      {
        id: 'final_output',
        type: 'output',
        position: { x: 2020, y: 160 },
        data: {
          nodeType: 'output',
          label: '输出',
          outputValue: '{{llm_answer.text}}',
        },
      },
    ];
  }

  private createDefaultEdges(): WorkflowEdge[] {
    return [
      { id: 'start-user_input', source: 'start', target: 'user_input' },
      {
        id: 'user_input-llm_rewrite',
        source: 'user_input',
        target: 'llm_rewrite',
      },
      {
        id: 'llm_rewrite-vector_retrieve',
        source: 'llm_rewrite',
        target: 'vector_retrieve',
      },
      {
        id: 'llm_rewrite-bm25_retrieve',
        source: 'llm_rewrite',
        target: 'bm25_retrieve',
      },
      {
        id: 'vector_retrieve-merge_results',
        source: 'vector_retrieve',
        target: 'merge_results',
      },
      {
        id: 'bm25_retrieve-merge_results',
        source: 'bm25_retrieve',
        target: 'merge_results',
      },
      {
        id: 'merge_results-rerank',
        source: 'merge_results',
        target: 'rerank',
      },
      {
        id: 'rerank-llm_answer',
        source: 'rerank',
        target: 'llm_answer',
      },
      {
        id: 'llm_answer-final_output',
        source: 'llm_answer',
        target: 'final_output',
      },
    ];
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }
}
