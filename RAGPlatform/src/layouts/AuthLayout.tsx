import { Layout, Typography } from "antd";
import { Outlet } from "react-router-dom";
import styles from "./AuthLayout.module.css";

const { Content } = Layout;

export function AuthLayout() {
  return (
    <Layout className={styles.layout}>
      <Content className={styles.content}>
        <div className={styles.container}>
          <Typography.Title
            level={3}
            className={styles.title}
          >
            RAG Platform
          </Typography.Title>
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
