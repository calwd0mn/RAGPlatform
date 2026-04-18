import { http } from "./http";
import type { ChunkContextResponse } from "../types/chunk";

interface GetChunkContextParams {
  before?: number;
  after?: number;
}

export async function getChunkContext(
  chunkId: string,
  params: GetChunkContextParams = {},
): Promise<ChunkContextResponse> {
  const response = await http.get<ChunkContextResponse>(
    `/chunks/${chunkId}/context`,
    {
      params: {
        before: params.before,
        after: params.after,
      },
    },
  );
  return response.data;
}

