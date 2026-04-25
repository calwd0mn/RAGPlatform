import { memo, useEffect, useState } from "react";
import { Button, Input, Space } from "antd";
import { SendOutlined, StopOutlined } from "@ant-design/icons";
import type { KeyboardEvent } from "react";
import styles from "./ChatInputBox.module.css";

interface ChatInputBoxProps {
  onSubmit: (value: string) => void;
  onAbort?: () => void;
  submitting?: boolean;
  streaming?: boolean;
  disabled?: boolean;
  resetKey?: string;
}

export const ChatInputBox = memo(function ChatInputBox({
  onSubmit,
  onAbort,
  submitting = false,
  streaming = false,
  disabled = false,
  resetKey = "",
}: ChatInputBoxProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!submitting) {
      return;
    }

    setValue("");
  }, [submitting]);

  useEffect(() => {
    setValue("");
  }, [resetKey]);

  const handlePressEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.shiftKey) {
      return;
    }
    if (submitting || disabled) {
      return;
    }
    event.preventDefault();
    void onSubmit(value);
  };
  const isButtonDisabled = disabled || (submitting && !streaming);

  return (
    <Space direction="vertical" size={12} className={styles.stack}>
      <Input.TextArea
        placeholder="输入你的问题，支持追问文档细节..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoSize={{ minRows: 3, maxRows: 6 }}
        onPressEnter={handlePressEnter}
        disabled={disabled}
      />
      <Button
        type={streaming ? "default" : "primary"}
        danger={streaming}
        icon={streaming ? <StopOutlined /> : <SendOutlined />}
        onClick={streaming ? onAbort : () => void onSubmit(value)}
        loading={submitting && !streaming}
        disabled={isButtonDisabled}
      >
        {streaming ? "停止生成" : "发送消息"}
      </Button>
    </Space>
  );
});
