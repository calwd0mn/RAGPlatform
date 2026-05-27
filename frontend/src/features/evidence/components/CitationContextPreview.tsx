import { Alert, Space, Typography } from "antd";
import { useCitationContext } from "../hooks/useCitationContext";

interface CitationContextPreviewProps {
  chunkId?: string;
  excerpt: string;
  fallbackBefore?: string;
  fallbackAfter?: string;
  expanded: boolean;
}

export function CitationContextPreview({
  chunkId,
  excerpt,
  fallbackBefore,
  fallbackAfter,
  expanded,
}: CitationContextPreviewProps) {
  const contextQuery = useCitationContext({
    chunkId,
    before: 1,
    after: 1,
    enabled: expanded,
  });

  const queryBefore = contextQuery.data?.previous[0]?.content;
  const queryCurrent = contextQuery.data?.current?.content;
  const queryAfter = contextQuery.data?.next[0]?.content;

  const beforeText = queryBefore?.trim() || fallbackBefore?.trim();
  const currentText = queryCurrent?.trim() || excerpt;
  const afterText = queryAfter?.trim() || fallbackAfter?.trim();
  const hasAnyContext = Boolean(beforeText || currentText || afterText);

  if (!expanded) {
    return null;
  }

  if (contextQuery.isLoading) {
    return (
      <Typography.Text type="secondary">
        正在加载 chunk 上下文...
      </Typography.Text>
    );
  }

  return (
    <Space direction="vertical" size={6}>
      {contextQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="上下文加载失败，已回退到本地可用片段。"
        />
      ) : null}
      {!chunkId ? (
        <Alert
          type="info"
          showIcon
          message="该 citation 缺少 chunkId，无法请求真实上下文。"
        />
      ) : null}
      {!hasAnyContext ? (
        <Typography.Text type="secondary">
          暂无可展示的上下文片段。
        </Typography.Text>
      ) : (
        <>
          {beforeText ? (
            <div>
              <Typography.Text type="secondary">前文</Typography.Text>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {beforeText}
              </Typography.Paragraph>
            </div>
          ) : null}
          <div>
            <Typography.Text type="secondary">命中</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {currentText}
            </Typography.Paragraph>
          </div>
          {afterText ? (
            <div>
              <Typography.Text type="secondary">后文</Typography.Text>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {afterText}
              </Typography.Paragraph>
            </div>
          ) : null}
        </>
      )}
    </Space>
  );
}

