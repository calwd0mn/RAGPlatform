import {
  BugOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MessageOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Space, Tabs, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { KnowledgeBaseSwitcher } from "../components/knowledge-base/KnowledgeBaseSwitcher";
import { useAuth } from "../hooks/useAuth";
import styles from "./AppLayout.module.css";

const { Header, Content } = Layout;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const activeTabKey =
    location.pathname.startsWith("/app/documents")
      ? "/app/documents"
      : location.pathname.startsWith("/app/debug/results")
        ? "/app/debug/results"
        : location.pathname.startsWith("/app/debug")
          ? "/app/debug"
        : "/app/chat";

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.topBar}>
          <Typography.Title level={4} className={styles.headerTitle}>
            文档问答工作台
          </Typography.Title>

          <Space size={12}>
            <KnowledgeBaseSwitcher />
            <Space size={8}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Typography.Text>{currentUser?.username ?? "未命名用户"}</Typography.Text>
            </Space>
            <Button icon={<LogoutOutlined />} onClick={handleLogout} type="default" danger>
              退出登录
            </Button>
          </Space>
        </div>

        <Tabs
          className={styles.tabs}
          activeKey={activeTabKey}
          onChange={(key) => navigate(key)}
          items={[
            {
              key: "/app/chat",
              label: (
                <Space size={6}>
                  <MessageOutlined />
                  对话
                </Space>
              ),
            },
            {
              key: "/app/debug",
              label: (
                <Space size={6}>
                  <BugOutlined />
                  策略设置
                </Space>
              ),
            },
            {
              key: "/app/debug/results",
              label: (
                <Space size={6}>
                  <ExperimentOutlined />
                  RAG 调试
                </Space>
              ),
            },
            {
              key: "/app/documents",
              label: (
                <Space size={6}>
                  <FileTextOutlined />
                  文档
                </Space>
              ),
            },
          ]}
        />
      </Header>

      <Content className={styles.content}>
        <Outlet />
      </Content>
    </Layout>
  );
}
