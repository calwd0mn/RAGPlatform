import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { ApiErrorPayload } from "../../types/api";
import type { RegisterPayload, RegisterRequest } from "../../types/auth";
import styles from "./RegisterPage.module.css";

function getRegisterErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "注册失败，请稍后重试。";
  }

  const { message } = error.response.data;
  return Array.isArray(message) ? message.join("；") : message;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<RegisterPayload>();
  const { register } = useAuth();

  const registerMutation = useMutation<void, AxiosError<ApiErrorPayload>, RegisterRequest>({
    mutationFn: (payload: RegisterRequest) => register(payload),
    onSuccess: () => {
      navigate("/app/chat", { replace: true });
    },
  });

  const handleFinish = (values: RegisterPayload) => {
    const registerPayload: RegisterRequest = {
      username: values.username,
      email: values.email,
      password: values.password,
    };
    registerMutation.mutate(registerPayload);
  };

  return (
    <Card>
      <Space direction="vertical" size={16} className={styles.stack}>
        <div>
          <Typography.Title level={4} className={styles.title}>
            创建账号
          </Typography.Title>
          <Typography.Text type="secondary">
            注册后即可进入文档问答工作台。
          </Typography.Text>
        </div>

        {registerMutation.isError ? (
          <Alert
            type="error"
            showIcon
            message={getRegisterErrorMessage(registerMutation.error)}
          />
        ) : null}

        <Form<RegisterPayload>
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="请输入用户名" autoComplete="username" />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input placeholder="name@example.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少 6 位" },
            ]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator: (_, value: string) => {
                  if (value === getFieldValue("password")) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" autoComplete="new-password" />
          </Form.Item>

          <Form.Item className={styles.submitRow}>
            <Button
              htmlType="submit"
              type="primary"
              block
              loading={registerMutation.isPending}
            >
              注册
            </Button>
          </Form.Item>
        </Form>

        <Typography.Text type="secondary">
          已有账号？<Link to="/login">去登录</Link>
        </Typography.Text>
      </Space>
    </Card>
  );
}
