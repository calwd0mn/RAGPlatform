import { lazy, Suspense, useState } from "react";
import { Button, Space, Tag, Typography } from "antd";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";

const KnowledgeBaseSelect = lazy(() =>
  import("./KnowledgeBaseSelect").then((module) => ({
    default: module.KnowledgeBaseSelect,
  })),
);

export function KnowledgeBaseSwitcher() {
  const [isSelecting, setIsSelecting] = useState(false);
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const currentKnowledgeBaseIsDefault = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseIsDefault,
  );
  const currentKnowledgeBaseName = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseName,
  );
  const knowledgeBaseLabel =
    currentKnowledgeBaseName || (currentKnowledgeBaseId ? "已选择知识库" : "选择知识库");

  return (
    <Space size={8}>
      <Typography.Text>知识库</Typography.Text>
      {isSelecting ? (
        <Suspense
          fallback={
            <Button style={{ minWidth: 220 }} loading>
              {knowledgeBaseLabel}
            </Button>
          }
        >
          <KnowledgeBaseSelect onSelected={() => setIsSelecting(false)} />
        </Suspense>
      ) : (
        <Button
          style={{ minWidth: 220 }}
          onClick={() => setIsSelecting(true)}
        >
          {knowledgeBaseLabel}
        </Button>
      )}
      {currentKnowledgeBaseIsDefault ? <Tag>默认</Tag> : null}
    </Space>
  );
}
