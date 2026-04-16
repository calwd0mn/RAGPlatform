import { Types } from 'mongoose';

interface VectorSearchStage {
  $vectorSearch: {
    index: string;
    path: string;
    queryVector: number[];
    numCandidates: number;
    limit: number;
    filter: {
      userId: Types.ObjectId;
    };
  };
}

interface ProjectStage {
  $project: {
    _id: 1;
    userId: 1;
    documentId: 1;
    content: 1;
    metadata: 1;
    score: {
      $meta: 'vectorSearchScore';
    };
  };
}

export function buildAtlasVectorSearchPipeline(input: {
  indexName: string;
  vectorPath: string;
  queryVector: number[];
  topK: number;
  candidateLimit: number;
  userId: Types.ObjectId;
}): [VectorSearchStage, ProjectStage] {
  return [
    {
      $vectorSearch: {
        index: input.indexName,
        path: input.vectorPath,
        queryVector: input.queryVector,
        numCandidates: Math.max(input.topK, input.candidateLimit),
        limit: input.topK,
        filter: {
          userId: input.userId,
        },
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        documentId: 1,
        content: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];
}
