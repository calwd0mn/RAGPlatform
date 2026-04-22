import type {
  ChunkStrategyDraft,
  DebugExperimentCreateRequest,
  DebugExperimentRecord,
  PromptDraft,
  RagPromptCurrentResponse,
} from "../../types/debug";

export interface ExperimentStrategyFormValue {
  name: string;
  type: "recursive" | "markdown" | "token";
  chunkSize: number;
  chunkOverlap: number;
  preserveSentenceBoundary: boolean;
  separatorsText?: string;
  maxSentenceMerge?: number;
  versionLabel?: string;
}

export interface ExperimentFormValues {
  queriesText: string;
  topK: number;
  mode: "retrieve-only" | "full-rag";
  basePromptId: string;
  promptVersionLabel?: string;
  systemPrompt: string;
  contextTemplate: string;
  chunkStrategyDrafts: ExperimentStrategyFormValue[];
}

export interface ChunkFormValues {
  experimentId?: string;
  strategyName?: string;
  keyword?: string;
  query?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export function parseErrorMessage(input: Error): string {
  const text = input.message.trim();
  return text.length > 0 ? text : "请求失败，请稍后重试。";
}

export function buildPromptDraft(values: ExperimentFormValues): PromptDraft {
  return {
    basePromptId: values.basePromptId.trim(),
    systemPrompt: values.systemPrompt.trim(),
    contextTemplate: values.contextTemplate.trim(),
    versionLabel: values.promptVersionLabel?.trim() || undefined,
  };
}

export function buildStrategyDrafts(
  values: ExperimentFormValues,
): ChunkStrategyDraft[] {
  return values.chunkStrategyDrafts.map(
    (item): ChunkStrategyDraft => ({
      name: item.name.trim(),
      type: item.type,
      chunkSize: item.chunkSize,
      chunkOverlap: item.chunkOverlap,
      preserveSentenceBoundary: item.preserveSentenceBoundary,
      separators: (item.separatorsText ?? "")
        .split(/\r?\n|,/)
        .map((entry): string => entry.trim())
        .filter((entry): boolean => entry.length > 0),
      maxSentenceMerge: item.maxSentenceMerge,
      versionLabel: item.versionLabel?.trim() || undefined,
    }),
  );
}

export function buildExperimentPayload(
  values: ExperimentFormValues,
  knowledgeBaseId: string,
): DebugExperimentCreateRequest {
  return {
    knowledgeBaseId,
    scope: "manual",
    queries: values.queriesText
      .split(/\r?\n/)
      .map((item): string => item.trim())
      .filter((item): boolean => item.length > 0),
    promptDraft: buildPromptDraft(values),
    chunkStrategyDrafts: buildStrategyDrafts(values),
    topK: values.topK,
    mode: values.mode,
  };
}

export function mapExperimentToForm(
  record: DebugExperimentRecord,
): ExperimentFormValues {
  return {
    queriesText: record.queries.join("\n"),
    topK: record.topK,
    mode: record.mode,
    basePromptId: record.promptDraft.basePromptId,
    promptVersionLabel: record.promptDraft.versionLabel,
    systemPrompt: record.promptDraft.systemPrompt,
    contextTemplate: record.promptDraft.contextTemplate,
    chunkStrategyDrafts: record.chunkStrategyDrafts.map(
      (item): ExperimentStrategyFormValue => ({
        name: item.name,
        type: item.type,
        chunkSize: item.chunkSize,
        chunkOverlap: item.chunkOverlap,
        preserveSentenceBoundary: item.preserveSentenceBoundary,
        separatorsText: item.separators.join("\n"),
        maxSentenceMerge: item.maxSentenceMerge,
        versionLabel: item.versionLabel,
      }),
    ),
  };
}

export function buildInitialExperimentFormValues(
  prompt: RagPromptCurrentResponse | undefined,
): ExperimentFormValues {
  return {
    queriesText: "请总结当前文档的核心结论",
    topK: 5,
    mode: "retrieve-only",
    basePromptId: prompt?.id ?? "rag-answer",
    promptVersionLabel: "draft",
    systemPrompt: prompt?.systemPrompt ?? "",
    contextTemplate: prompt?.contextTemplate ?? "检索上下文如下：\n{context}",
    chunkStrategyDrafts: [
      {
        name: "sentence-recursive-v1",
        type: "recursive",
        chunkSize: 800,
        chunkOverlap: 150,
        preserveSentenceBoundary: true,
        separatorsText: "。\n！\n？\n；\n\n",
        versionLabel: "draft",
      },
    ],
  };
}

export function buildInitialChunkFormValues(): ChunkFormValues {
  return {
    limit: 20,
    offset: 0,
  };
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function getExperimentStatusColor(
  status: DebugExperimentRecord["status"],
): string {
  const colorMap: Record<DebugExperimentRecord["status"], string> = {
    draft: "default",
    running: "processing",
    completed: "success",
    failed: "error",
    published: "gold",
  };
  return colorMap[status];
}
