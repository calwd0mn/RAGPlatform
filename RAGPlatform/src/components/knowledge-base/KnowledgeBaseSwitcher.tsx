import { useEffect } from "react";
import { Select, Space, Tag, Typography } from "antd";
import { useKnowledgeBaseList } from "../../hooks/knowledge-base/useKnowledgeBaseList";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";

export function KnowledgeBaseSwitcher() {
  const knowledgeBaseListQuery = useKnowledgeBaseList();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const setCurrentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.setCurrentKnowledgeBaseId,
  );

  useEffect(() => {
    const list = knowledgeBaseListQuery.data ?? [];
    if (list.length === 0) {
      return;
    }

    const existing = list.find((item) => item.id === currentKnowledgeBaseId);
    if (existing) {
      return;
    }

    const nextKnowledgeBase = list.find((item) => item.isDefault) ?? list[0];
    if (nextKnowledgeBase) {
      setCurrentKnowledgeBaseId(nextKnowledgeBase.id);
    }
  }, [
    currentKnowledgeBaseId,
    knowledgeBaseListQuery.data,
    setCurrentKnowledgeBaseId,
  ]);

  const selectedKnowledgeBase = (knowledgeBaseListQuery.data ?? []).find(
    (item) => item.id === currentKnowledgeBaseId,
  );

  return (
    <Space size={8}>
      <Typography.Text>知识库</Typography.Text>
      <Select
        value={currentKnowledgeBaseId || undefined}
        loading={knowledgeBaseListQuery.isLoading}
        style={{ minWidth: 220 }}
        options={(knowledgeBaseListQuery.data ?? []).map((item) => ({
          label: item.name,
          value: item.id,
        }))}
        onChange={(value: string) => setCurrentKnowledgeBaseId(value)}
        placeholder="选择知识库"
      />
      {selectedKnowledgeBase?.isDefault ? <Tag>默认</Tag> : null}
    </Space>
  );
}
