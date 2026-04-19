import { InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Button, Space, Upload, message } from "antd";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import { useState } from "react";
import { queryKeys } from "../../constants/queryKeys";
import { useUploadDocument } from "../../hooks/document/useUploadDocument";
import { useKnowledgeBaseStore } from "../../stores/knowledge-base.store";
import type { ApiErrorPayload } from "../../types/api";
import styles from "./DocumentUploadPanel.module.css";

const { Dragger } = Upload;

export function DocumentUploadPanel() {
  const queryClient = useQueryClient();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadMutation = useUploadDocument();
  const knowledgeBaseId = useKnowledgeBaseStore(
    (state) => state.currentKnowledgeBaseId,
  );

  const resolveErrorMessage = (
    error: AxiosError<ApiErrorPayload> | null,
  ): string => {
    if (!error?.response?.data?.message) {
      return "上传失败，请稍后重试。";
    }
    const { message: errorMessage } = error.response.data;
    return Array.isArray(errorMessage) ? errorMessage.join("；") : errorMessage;
  };

  const handleChange: UploadProps["onChange"] = ({
    fileList: nextFileList,
  }) => {
    setFileList(nextFileList);
  };

  const updateFileStatus = (uid: string, status: UploadFile["status"]) => {
    setFileList((current) =>
      current.map((file) =>
        file.uid === uid
          ? {
              ...file,
              status,
            }
          : file,
      ),
    );
  };

  const handleUpload = async () => {
    const pendingFiles = fileList.filter(
      (file): file is UploadFile & { originFileObj: File } =>
        Boolean(file.originFileObj) && file.status !== "done",
    );

    if (!pendingFiles.length) {
      message.info("请先选择待上传文件。");
      return;
    }
    if (knowledgeBaseId.length === 0) {
      message.warning("请先选择知识库。");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (const fileItem of pendingFiles) {
      updateFileStatus(fileItem.uid, "uploading");
      try {
        await uploadMutation.mutateAsync(fileItem.originFileObj);
        updateFileStatus(fileItem.uid, "done");
        successCount += 1;
      } catch (error) {
        const uploadError = error as AxiosError<ApiErrorPayload>;
        updateFileStatus(fileItem.uid, "error");
        failedCount += 1;
        message.error(`${fileItem.name}：${resolveErrorMessage(uploadError)}`);
      }
    }

    if (successCount > 0) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.documents.list(knowledgeBaseId),
      });
    }

    if (failedCount === 0) {
      message.success(`上传完成：成功 ${successCount} 个文件。`);
    } else {
      message.warning(
        `上传完成：成功 ${successCount} 个，失败 ${failedCount} 个。`,
      );
    }

    setIsUploading(false);
  };

  return (
    <div className={styles.wrapper}>
      <Dragger
        multiple
        beforeUpload={() => false}
        className={styles.dragger}
        itemRender={(originNode) => originNode}
        fileList={fileList}
        onChange={handleChange}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">拖拽文件到此处，或点击上传</p>
        <p className="ant-upload-hint">
          支持 PDF / DOCX / TXT。上传后可在列表中开始入库。
        </p>
        <Space className={styles.buttonWrap}>
          <Button type="primary" icon={<UploadOutlined />}>
            选择文件
          </Button>
        </Space>
      </Dragger>

      <Space size={8} className={styles.actionBar}>
        <Button
          type="primary"
          loading={isUploading}
          onClick={() => {
            void handleUpload();
          }}
          disabled={!fileList.length || knowledgeBaseId.length === 0}
        >
          开始上传
        </Button>
        <Button
          onClick={() => setFileList([])}
          disabled={isUploading || !fileList.length}
        >
          清空列表
        </Button>
      </Space>
    </div>
  );
}
