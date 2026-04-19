import { http } from "./http";
import type { ChunkContextResponse } from "../types/chunk";

interface GetChunkContextParams {
  knowledgeBaseId: string;
  before?: number;
  after?: number;
  experimentId?: string;
}

export async function getChunkContext(
  chunkId: string,
  params: GetChunkContextParams,
): Promise<ChunkContextResponse> {
  const response = await http.get<ChunkContextResponse>(
    `/chunks/${chunkId}/context`,
    {
      params: {
        knowledgeBaseId: params.knowledgeBaseId,
        before: params.before,
        after: params.after,
        experimentId: params.experimentId,
      },
    },
  );
  return response.data;
}
