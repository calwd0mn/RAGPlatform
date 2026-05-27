import { Alert, Form, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import type { ConversationItem } from "../../types/chat";

interface RenameConversationModalProps {
  open: boolean;
  conversation: ConversationItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onSubmit: (title: string) => Promise<void>;
}

interface RenameConversationFormValue {
  title: string;
}

export function RenameConversationModal({
  open,
  conversation,
  confirmLoading,
  onCancel,
  onSubmit,
}: RenameConversationModalProps) {
  const [form] = Form.useForm<RenameConversationFormValue>();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setErrorMessage("");
      return;
    }
    form.setFieldsValue({ title: conversation?.title ?? "" });
  }, [conversation?.title, form, open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const nextTitle = values.title.trim();
    if (!nextTitle) {
      return;
    }
    if (nextTitle === (conversation?.title ?? "")) {
      onCancel();
      return;
    }
    setErrorMessage("");
    try {
      await onSubmit(nextTitle);
    } catch {
      setErrorMessage("重命名失败，请稍后重试。");
    }
  };

  return (
    <Modal
      title="重命名会话"
      open={open}
      okText="保存"
      cancelText="取消"
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={() => {
        void handleOk();
      }}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item<RenameConversationFormValue>
          label="会话标题"
          name="title"
          rules={[
            { required: true, message: "请输入会话标题" },
            { max: 100, message: "会话标题不能超过 100 个字符" },
            {
              validator: async (_, value: string) => {
                if (value.trim()) {
                  return;
                }
                throw new Error("请输入会话标题");
              },
            },
          ]}
        >
          <Input
            placeholder="请输入新的会话标题"
            maxLength={100}
            autoFocus
            onPressEnter={(event) => {
              event.preventDefault();
              void handleOk();
            }}
          />
        </Form.Item>
      </Form>
      {errorMessage ? (
        <Alert type="error" showIcon message={errorMessage} />
      ) : null}
    </Modal>
  );
}
