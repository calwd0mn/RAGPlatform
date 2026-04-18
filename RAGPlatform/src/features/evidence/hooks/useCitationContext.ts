import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../constants/queryKeys";
import { getChunkContext } from "../../../services/chunks";
import type { ChunkContextResponse } from "../../../types/chunk";

interface UseCitationContextParams {
  chunkId?: string;
  before?: number;
  after?: number;
  enabled?: boolean;
}

export function useCitationContext({
  chunkId,
  before = 1,
  after = 1,
  enabled = true,
}: UseCitationContextParams) {
  return useQuery<ChunkContextResponse, Error>({
    queryKey: chunkId
      ? queryKeys.chunks.context(chunkId, before, after)
      : ["chunks", "context", "empty", before, after],
    queryFn: () => {
      if (!chunkId) {
        throw new Error("chunkId is required");
      }
      return getChunkContext(chunkId, { before, after });
    },
    enabled: enabled && Boolean(chunkId),
    staleTime: 30_000,
  });
}
