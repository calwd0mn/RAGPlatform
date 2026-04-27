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
import {
  Workflow,
  WorkflowDocument,
} from '../schemas/workflow.schema';

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
    const nodes = dto.nodes.map((node): WorkflowNode => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: this.normalizeNodeData(node.data),
    }));
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
    topK?: number;
    conditions?: Array<{
      variable: string;
      operator: string;
      value: string | number | boolean;
    }>;
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

  private isConditionOperator(value: string): value is WorkflowConditionOperator {
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
        id: 'rag_search',
        type: 'rag',
        position: { x: 620, y: 160 },
        data: {
          nodeType: 'rag',
          label: 'RAG 检索',
          query: '{{user_input.value}}',
          topK: 5,
        },
      },
      {
        id: 'final_output',
        type: 'output',
        position: { x: 920, y: 160 },
        data: {
          nodeType: 'output',
          label: '输出',
          outputValue: '{{user_input.value}}',
        },
      },
    ];
  }

  private createDefaultEdges(): WorkflowEdge[] {
    return [
      { id: 'start-user_input', source: 'start', target: 'user_input' },
      {
        id: 'user_input-rag_search',
        source: 'user_input',
        target: 'rag_search',
      },
      {
        id: 'rag_search-final_output',
        source: 'rag_search',
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
