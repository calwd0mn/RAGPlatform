import { DatabaseOutlined } from "@ant-design/icons";
import { Alert, Button, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import styles from "./KnowledgeBaseStatusBar.module.css";

export function KnowledgeBaseStatusBar() {
  const navigate = useNavigate();
  const currentKnowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );
  const currentKnowledgeBaseName = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseName,
  );
  const knowledgeBaseLabel =
    currentKnowledgeBaseName || (currentKnowledgeBaseId ? "已选择知识库" : "未选择知识库");

  return (
    <Alert
      showIcon
      className={styles.banner}
      type={currentKnowledgeBaseId ? "success" : "info"}
      message={
        <Space size={10} wrap>
          <Space size={6}>
            <DatabaseOutlined />
            <Typography.Text strong>知识库状态</Typography.Text>
          </Space>
          <Tag color="blue">{knowledgeBaseLabel}</Tag>
          <Typography.Text type="secondary">
            {currentKnowledgeBaseId
              ? "可直接开始提问，文档详情可前往文档页查看。"
              : "请先选择知识库。"}
          </Typography.Text>
        </Space>
      }
      action={
        <Button type="default" size="small" onClick={() => navigate("/app/documents")}>
          去文档页
        </Button>
      }
    />
  );
}
