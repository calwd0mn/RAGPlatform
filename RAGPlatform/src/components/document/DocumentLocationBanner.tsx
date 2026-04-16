import type { ReactNode } from "react";
import { Alert, Space, Tag, Typography } from "antd";
import type { DocumentRecord } from "../../types/document";
import type { DocumentLocationQuery } from "../../utils/document-location";
import styles from "./DocumentLocationBanner.module.css";

interface DocumentLocationBannerProps {
  locationQuery: DocumentLocationQuery;
  matchedDocument?: DocumentRecord;
}

function hasLocationIntent(locationQuery: DocumentLocationQuery): boolean {
  return Boolean(locationQuery.documentId || locationQuery.page || locationQuery.chunkId);
}

function renderMetaTags(locationQuery: DocumentLocationQuery): ReactNode {
  return (
    <Space size={8} wrap className={styles.metaWrap}>
      <Tag color={typeof locationQuery.page === "number" ? "blue" : "default"}>
        page: {typeof locationQuery.page === "number" ? locationQuery.page : "未提供"}
      </Tag>
      <Tag color={locationQuery.chunkId ? "blue" : "default"}>
        chunkId: {locationQuery.chunkId ?? "未提供"}
      </Tag>
    </Space>
  );
}

export function DocumentLocationBanner({
  locationQuery,
  matchedDocument,
}: DocumentLocationBannerProps) {
  if (!hasLocationIntent(locationQuery)) {
    return null;
  }

  if (!locationQuery.documentId) {
    return (
      <Alert
        type="warning"
        showIcon
        className={styles.banner}
        title="收到定位参数，但缺少 documentId，无法精确定位文档。"
        description={renderMetaTags(locationQuery)}
      />
    );
  }

  if (!matchedDocument) {
    return (
      <Alert
        type="error"
        showIcon
        className={styles.banner}
        title={`未找到 documentId=${locationQuery.documentId} 对应文档`}
        description={renderMetaTags(locationQuery)}
      />
    );
  }

  return (
    <Alert
      type="success"
      showIcon
      className={styles.banner}
      title={
        <Space size={8} wrap>
          <Typography.Text strong>已定位文档：</Typography.Text>
          <Typography.Text>{matchedDocument.filename}</Typography.Text>
        </Space>
      }
      description={renderMetaTags(locationQuery)}
    />
  );
}
