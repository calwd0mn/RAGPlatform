import {
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Space, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { KnowledgeBaseSwitcher } from "../components/knowledge-base/KnowledgeBaseSwitcher";
import { useAuth } from "../hooks/useAuth";
import styles from "./AppLayout.module.css";

const { Header, Content } = Layout;

const navigationItems = [
  { key: "/app/chat", label: "对话" },
  { key: "/app/documents", label: "文档" },
  { key: "/app/workflow", label: "工作流" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const activeTabKey = location.pathname.startsWith("/app/documents")
    ? "/app/documents"
    : location.pathname.startsWith("/app/workflow")
      ? "/app/workflow"
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
              <Typography.Text>
                {currentUser?.username ?? "未命名用户"}
              </Typography.Text>
            </Space>
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              type="default"
              danger
            >
              退出登录
            </Button>
          </Space>
        </div>

        <nav className={styles.nav} aria-label="主导航">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.navItem} ${
                activeTabKey === item.key ? styles.navItemActive : ""
              }`}
              aria-current={activeTabKey === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </Header>

      <Content className={styles.content}>
        <Outlet />
      </Content>
    </Layout>
  );
}
