import type { RagCitation } from "../types/rag";

interface IndexedCitation {
  citation: RagCitation;
  citationIndex: number;
}

export interface CitationAggregateItem {
  key: string;
  citation: RagCitation;
  citationIndex: number;
  mergedCitationIndices: number[];
  mergedCount: number;
  beforeContext?: RagCitation;
  afterContext?: RagCitation;
}

export interface CitationDocumentGroup {
  key: string;
  documentId?: string;
  documentName: string;
  rawCount: number;
  aggregatedCount: number;
  items: CitationAggregateItem[];
}

function normalizeText(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function parseChunkOrder(chunkId: string | undefined): number | null {
  if (!chunkId) {
    return null;
  }
  const matched = chunkId.match(/\d+/g);
  if (!matched?.length) {
    return null;
  }
  const lastNumber = matched[matched.length - 1];
  const parsed = Number(lastNumber);
  return Number.isNaN(parsed) ? null : parsed;
}

function isPageAdjacent(left: RagCitation, right: RagCitation): boolean {
  if (typeof left.page !== "number" || typeof right.page !== "number") {
    return false;
  }
  return Math.abs(left.page - right.page) <= 1;
}

function isChunkAdjacent(left: RagCitation, right: RagCitation): boolean {
  const leftOrder = parseChunkOrder(left.chunkId);
  const rightOrder = parseChunkOrder(right.chunkId);
  if (leftOrder === null || rightOrder === null) {
    return false;
  }
  return Math.abs(leftOrder - rightOrder) <= 1;
}

function isDuplicateContent(left: RagCitation, right: RagCitation): boolean {
  const leftContent = normalizeText(left.content);
  const rightContent = normalizeText(right.content);
  return leftContent.length > 0 && leftContent === rightContent;
}

function shouldMerge(left: RagCitation, right: RagCitation): boolean {
  return (
    isDuplicateContent(left, right) ||
    isPageAdjacent(left, right) ||
    isChunkAdjacent(left, right)
  );
}

function renderDocumentName(
  documentName: string | undefined,
  fallbackIndex: number,
): string {
  const trimmed = documentName?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `文档 ${fallbackIndex + 1}`;
}

function buildDocumentKey(citation: RagCitation, fallbackIndex: number): string {
  const documentId = citation.documentId?.trim();
  const documentName = citation.documentName?.trim();
  if (documentId) {
    return `doc:${documentId}`;
  }
  if (documentName) {
    return `name:${documentName}`;
  }
  return `unknown:${fallbackIndex}`;
}

function resolvePrimaryCitation(cluster: IndexedCitation[]): IndexedCitation {
  return cluster.reduce((best, current) => {
    if (
      typeof current.citation.score === "number" &&
      typeof best.citation.score === "number" &&
      current.citation.score > best.citation.score
    ) {
      return current;
    }
    if (
      typeof current.citation.score === "number" &&
      typeof best.citation.score !== "number"
    ) {
      return current;
    }
    return best;
  }, cluster[0]);
}

export function buildCitationDocumentGroups(
  citations: RagCitation[],
): CitationDocumentGroup[] {
  const grouped = new Map<string, IndexedCitation[]>();

  citations.forEach((citation, citationIndex) => {
    const key = buildDocumentKey(citation, citationIndex);
    const items = grouped.get(key);
    if (items) {
      items.push({ citation, citationIndex });
      return;
    }
    grouped.set(key, [{ citation, citationIndex }]);
  });

  return Array.from(grouped.entries()).map(([groupKey, indexedCitations], groupIndex) => {
    const clusters: IndexedCitation[][] = [];
    let currentCluster: IndexedCitation[] = [];

    indexedCitations.forEach((item) => {
      if (!currentCluster.length) {
        currentCluster = [item];
        return;
      }
      const lastItem = currentCluster[currentCluster.length - 1];
      if (shouldMerge(lastItem.citation, item.citation)) {
        currentCluster.push(item);
        return;
      }
      clusters.push(currentCluster);
      currentCluster = [item];
    });

    if (currentCluster.length) {
      clusters.push(currentCluster);
    }

    const items = clusters.map((cluster, clusterIndex) => {
      const primary = resolvePrimaryCitation(cluster);
      const firstCitationPosition = indexedCitations.findIndex(
        (item) => item.citationIndex === cluster[0].citationIndex,
      );
      const lastCitationPosition = indexedCitations.findIndex(
        (item) => item.citationIndex === cluster[cluster.length - 1].citationIndex,
      );
      const beforeContext =
        firstCitationPosition > 0
          ? indexedCitations[firstCitationPosition - 1].citation
          : undefined;
      const afterContext =
        lastCitationPosition >= 0 && lastCitationPosition < indexedCitations.length - 1
          ? indexedCitations[lastCitationPosition + 1].citation
          : undefined;

      return {
        key: `${groupKey}-${clusterIndex}-${primary.citationIndex}`,
        citation: primary.citation,
        citationIndex: primary.citationIndex,
        mergedCitationIndices: cluster.map((item) => item.citationIndex),
        mergedCount: cluster.length,
        beforeContext,
        afterContext,
      };
    });

    const leadCitation = indexedCitations[0]?.citation;
    return {
      key: groupKey,
      documentId: leadCitation?.documentId,
      documentName: renderDocumentName(leadCitation?.documentName, groupIndex),
      rawCount: indexedCitations.length,
      aggregatedCount: items.length,
      items,
    };
  });
}
