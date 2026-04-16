import { Button, Input, Space } from "antd";
import { SendOutlined } from "@ant-design/icons";
import type { KeyboardEvent } from "react";
import styles from "./ChatInputBox.module.css";

interface ChatInputBoxProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean;
}

export function ChatInputBox({
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
}: ChatInputBoxProps) {
  const handlePressEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.shiftKey) {
      return;
    }
    if (submitting || disabled) {
      return;
    }
    event.preventDefault();
    onSubmit();
  };

  return (
    <Space direction="vertical" size={12} className={styles.stack}>
      <Input.TextArea
        placeholder="输入你的问题，支持追问文档细节..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoSize={{ minRows: 3, maxRows: 6 }}
        onPressEnter={handlePressEnter}
        disabled={disabled}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={onSubmit}
        loading={submitting}
        disabled={disabled}
      >
        发送消息
      </Button>
    </Space>
  );
}
