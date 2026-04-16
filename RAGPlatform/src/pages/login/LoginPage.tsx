import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { ApiErrorPayload } from "../../types/api";
import type { LoginPayload } from "../../types/auth";
import styles from "./LoginPage.module.css";

function getLoginErrorMessage(error: AxiosError<ApiErrorPayload> | null): string {
  if (!error?.response?.data?.message) {
    return "登录失败，请稍后重试。";
  }

  const { message } = error.response.data;
  return Array.isArray(message) ? message.join("；") : message;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const loginMutation = useMutation<void, AxiosError<ApiErrorPayload>, LoginPayload>({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: () => {
      navigate("/app/chat", { replace: true });
    },
  });

  const handleFinish = (values: LoginPayload) => {
    loginMutation.mutate(values);
  };

  return (
    <Card>
      <Space direction="vertical" size={16} className={styles.stack}>
        <div>
          <Typography.Title level={4} className={styles.title}>
            登录账号
          </Typography.Title>
          <Typography.Text type="secondary">
            使用你的邮箱和密码进入工作台。
          </Typography.Text>
        </div>

        {loginMutation.isError ? (
          <Alert
            type="error"
            showIcon
            message={getLoginErrorMessage(loginMutation.error)}
          />
        ) : null}

        <Form<LoginPayload> layout="vertical" onFinish={handleFinish} requiredMark={false}>
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
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>

          <Form.Item className={styles.submitRow}>
            <Button
              htmlType="submit"
              type="primary"
              block
              loading={loginMutation.isPending}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <Typography.Text type="secondary">
          还没有账号？<Link to="/register">去注册</Link>
        </Typography.Text>
      </Space>
    </Card>
  );
}
