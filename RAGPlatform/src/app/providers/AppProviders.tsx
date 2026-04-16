import { QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider } from "antd";
import type { PropsWithChildren } from "react";
import { AuthProvider } from "../../hooks/useAuth";
import { queryClient } from "./queryClient";
import styles from "../../styles/theme.module.css";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0891B2",
          colorInfo: "#0891B2",
          borderRadius: 10,
        },
      }}
    >
      <div className={styles.appTheme}>
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        </AntdApp>
      </div>
    </ConfigProvider>
  );
}
