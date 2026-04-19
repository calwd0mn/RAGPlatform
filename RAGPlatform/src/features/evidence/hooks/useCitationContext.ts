import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../constants/queryKeys";
import { getChunkContext } from "../../../services/chunks";
import { useKnowledgeBaseStore } from "../../../stores/knowledge-base.store";
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
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  return useQuery<ChunkContextResponse, Error>({
    queryKey: chunkId
      ? queryKeys.chunks.context(knowledgeBaseId, chunkId, before, after)
      : ["chunks", "context", knowledgeBaseId, "empty", before, after],
    queryFn: () => {
      if (!chunkId) {
        throw new Error("chunkId is required");
      }
      return getChunkContext(chunkId, { knowledgeBaseId, before, after });
    },
    enabled: enabled && Boolean(chunkId) && knowledgeBaseId.length > 0,
    staleTime: 30_000,
  });
}
