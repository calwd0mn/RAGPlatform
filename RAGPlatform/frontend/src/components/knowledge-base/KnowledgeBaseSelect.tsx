import { useEffect, useMemo } from "react";
import { Select } from "antd";
import { useKnowledgeBaseList } from "../../hooks/knowledge-base/useKnowledgeBaseList";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";

interface KnowledgeBaseSelectProps {
  onSelected: () => void;
}

export function KnowledgeBaseSelect({ onSelected }: KnowledgeBaseSelectProps) {
  const knowledgeBaseListQuery = useKnowledgeBaseList();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const setCurrentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.setCurrentKnowledgeBaseId,
  );
  const knowledgeBases = knowledgeBaseListQuery.data ?? [];

  useEffect(() => {
    if (knowledgeBases.length === 0) {
      return;
    }

    const existing = knowledgeBases.find(
      (item) => item.id === currentKnowledgeBaseId,
    );
    if (existing) {
      setCurrentKnowledgeBaseId(existing.id, existing.name, existing.isDefault);
      return;
    }

    const nextKnowledgeBase =
      knowledgeBases.find((item) => item.isDefault) ?? knowledgeBases[0];
    setCurrentKnowledgeBaseId(
      nextKnowledgeBase.id,
      nextKnowledgeBase.name,
      nextKnowledgeBase.isDefault,
    );
  }, [currentKnowledgeBaseId, knowledgeBases, setCurrentKnowledgeBaseId]);

  const options = useMemo(
    () =>
      knowledgeBases.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [knowledgeBases],
  );

  return (
    <Select
      autoFocus
      open
      value={currentKnowledgeBaseId || undefined}
      loading={knowledgeBaseListQuery.isLoading}
      style={{ minWidth: 220 }}
      options={options}
      onBlur={onSelected}
      onChange={(value: string) => {
        const selectedKnowledgeBase = knowledgeBases.find(
          (item) => item.id === value,
        );
        setCurrentKnowledgeBaseId(
          value,
          selectedKnowledgeBase?.name ?? "",
          selectedKnowledgeBase?.isDefault ?? false,
        );
        onSelected();
      }}
      placeholder="选择知识库"
    />
  );
}
