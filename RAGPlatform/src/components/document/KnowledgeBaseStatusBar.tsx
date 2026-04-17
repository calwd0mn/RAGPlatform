import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Button, Space, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentList } from "../../hooks/document/useDocumentList";
import { toDocumentDisplayStatus } from "../../utils/document-status";
import styles from "./KnowledgeBaseStatusBar.module.css";

export function KnowledgeBaseStatusBar() {
  const navigate = useNavigate();
  const documentListQuery = useDocumentList();

  const readyCount = useMemo(() => {
    const documents = documentListQuery.data ?? [];
    return documents.filter((item) => toDocumentDisplayStatus(item.status) === "ready").length;
  }, [documentListQuery.data]);

  if (documentListQuery.isError) {
    return (
      <Alert
        showIcon
        type="warning"
        className={styles.banner}
        message="知识库状态暂时无法读取，不影响继续提问。"
        action={
          <Button size="small" onClick={() => navigate("/app/documents")}>
            去文档页
          </Button>
        }
      />
    );
  }

  const isEmpty = readyCount === 0;

  return (
    <Alert
      showIcon
      className={styles.banner}
      type={isEmpty ? "info" : "success"}
      message={
        <Space size={10} wrap>
          <Space size={6}>
            <DatabaseOutlined />
            <Typography.Text strong>知识库状态</Typography.Text>
          </Space>
          <Tag color={isEmpty ? "default" : "success"}>可问答文档 {readyCount}</Tag>
          <Typography.Text type={isEmpty ? "warning" : "secondary"}>
            {isEmpty
              ? "当前没有可问答文档，请先去文档页上传并完成入库。"
              : "已有可问答文档，可直接开始提问。"}
          </Typography.Text>
        </Space>
      }
      action={
        <Button type={isEmpty ? "primary" : "default"} size="small" onClick={() => navigate("/app/documents")}>
          去文档页
        </Button>
      }
    />
  );
}
