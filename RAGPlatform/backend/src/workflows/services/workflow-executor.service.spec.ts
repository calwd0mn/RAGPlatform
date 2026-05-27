import { Types } from 'mongoose';
import { Subject } from 'rxjs';
import { RagService } from '../../rag/rag.service';
import {
  WorkflowEdge,
  WorkflowNode,
} from '../interfaces/workflow-node.interface';
import { WorkflowDocument } from '../schemas/workflow.schema';
import {
  WorkflowExecutorService,
  WorkflowStreamEvent,
} from './workflow-executor.service';
import { WorkflowsService } from './workflows.service';

interface WorkflowMockInput {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function createWorkflowDocument(input: WorkflowMockInput): WorkflowDocument {
  return {
    knowledgeBaseId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    nodes: input.nodes,
    edges: input.edges,
  } as unknown as WorkflowDocument;
}

describe('WorkflowExecutorService', () => {
  const userId = '507f191e810c19729de860ea';
  const workflowId = '507f1f77bcf86cd799439012';

  function createService(workflow: WorkflowDocument): {
    service: WorkflowExecutorService;
    ragService: jest.Mocked<Pick<RagService, 'retrieveForWorkflow' | 'answerWorkflow'>>;
  } {
    const workflowsService = {
      findOwnedDocument: jest.fn().mockResolvedValue(workflow),
    } as unknown as WorkflowsService;
    const ragService = {
      retrieveForWorkflow: jest.fn().mockResolvedValue({
        query: '什么是 RAG',
        topK: 5,
        chunks: [],
        citations: [],
        retrievalProvider: 'local',
      }),
      answerWorkflow: jest.fn().mockResolvedValue({
        answer: 'RAG 是检索增强生成。',
        citations: [],
        trace: {
          knowledgeBaseId: '507f1f77bcf86cd799439011',
          query: '什么是 RAG',
          topK: 5,
          retrievedCount: 0,
          contextChunkCount: 0,
          contextCharCount: 0,
          contextTrimmed: false,
          model: 'fake-rag-model',
          retrievalProvider: 'local',
          promptVersion: 'rag-answer@v1',
          latencyMs: 1,
        },
      }),
    } as jest.Mocked<Pick<RagService, 'retrieveForWorkflow' | 'answerWorkflow'>>;

    return {
      service: new WorkflowExecutorService(
        workflowsService,
        ragService as unknown as RagService,
      ),
      ragService,
    };
  }

  it('executes user input, RAG and output nodes', async () => {
    const workflow = createWorkflowDocument({
      nodes: [
        {
          id: 'user_input',
          type: 'userInput',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'userInput',
            label: '用户输入',
            inputField: 'question',
          },
        },
        {
          id: 'rag_search',
          type: 'rag',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'rag',
            label: 'RAG',
            query: '{{user_input.value}}',
            topK: 5,
          },
        },
        {
          id: 'final_output',
          type: 'output',
          position: { x: 400, y: 0 },
          data: {
            nodeType: 'output',
            label: '输出',
            outputValue: '{{user_input.value}}',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'user_input', target: 'rag_search' },
        { id: 'e2', source: 'rag_search', target: 'final_output' },
      ],
    });
    const { service, ragService } = createService(workflow);

    const result = await service.execute({
      userId,
      workflowId,
      inputs: { question: '什么是 RAG' },
    });

    expect(ragService.retrieveForWorkflow).toHaveBeenCalledWith({
      userId,
      knowledgeBaseId: '507f1f77bcf86cd799439011',
      query: '什么是 RAG',
      topK: 5,
    });
    expect(result.output).toBe('RAG 是检索增强生成。');
  });

  it('skips the inactive condition branch', async () => {
    const workflow = createWorkflowDocument({
      nodes: [
        {
          id: 'condition',
          type: 'condition',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'condition',
            label: '条件',
            conditions: [
              {
                variable: '{{user_input.value}}',
                operator: 'contains',
                value: 'yes',
              },
            ],
          },
        },
        {
          id: 'true_output',
          type: 'output',
          position: { x: 200, y: 0 },
          data: {
            nodeType: 'output',
            label: '真',
            outputValue: 'true',
          },
        },
        {
          id: 'false_output',
          type: 'output',
          position: { x: 200, y: 120 },
          data: {
            nodeType: 'output',
            label: '假',
            outputValue: 'false',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'condition',
          target: 'true_output',
          sourceHandle: 'true',
        },
        {
          id: 'e2',
          source: 'condition',
          target: 'false_output',
          sourceHandle: 'false',
        },
      ],
    });
    const { service } = createService(workflow);
    const events = new Subject<WorkflowStreamEvent>();
    const skippedNodes: string[] = [];
    events.subscribe((event) => {
      if (event.type === 'node_status' && event.data.status === 'skipped') {
        skippedNodes.push(event.data.nodeId);
      }
    });

    await service.execute({
      userId,
      workflowId,
      inputs: {},
      events,
    });

    expect(skippedNodes).toEqual(['true_output']);
  });

  it('fails when required user input is missing', async () => {
    const workflow = createWorkflowDocument({
      nodes: [
        {
          id: 'user_input',
          type: 'userInput',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'userInput',
            label: '用户输入',
            inputField: 'question',
          },
        },
      ],
      edges: [],
    });
    const { service } = createService(workflow);

    await expect(
      service.execute({
        userId,
        workflowId,
        inputs: {},
      }),
    ).rejects.toThrow('Missing required input: question');
  });
});
