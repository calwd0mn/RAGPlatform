import { InboxOutlined } from "@ant-design/icons";
import { Upload } from "antd";
import styles from "./DocumentUploadPanel.module.css";

const { Dragger } = Upload;

export function DocumentUploadPanel() {
  return (
    <Dragger
      multiple
      beforeUpload={() => false}
      className={styles.dragger}
      itemRender={(originNode) => originNode}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">拖拽文件到此处，或点击上传</p>
      <p className="ant-upload-hint">支持 PDF / DOCX / TXT，后续将接入 ingestion 接口。</p>
    </Dragger>
  );
}
