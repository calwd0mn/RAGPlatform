import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../../layouts/AppLayout";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Spin } from "antd"; // 可替换为你自定义的整体 loading

// 🚨 将原先的 import 替换为 lazy 动态加载
const ChatWorkbenchPage = lazy(() =>
  import("../../pages/chat/ChatWorkbenchPage").then((module) => ({
    default: module.ChatWorkbenchPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("../../pages/documents/DocumentsPage").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const LoginPage = lazy(() =>
  import("../../pages/login/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../../pages/register/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);

// 全局的加载状态占位组件
const PageFallback = () => (
  <div
    style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <Spin size="large" />
  </div>
);

export function AppRouter() {
  return (
    // ✨ 外层包裹 Suspense 以处理异步加载过程
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/chat" replace />} />
            <Route path="chat" element={<ChatWorkbenchPage />} />
            <Route
              path="chat/:conversationId"
              element={<ChatWorkbenchPage />}
            />
            <Route path="documents" element={<DocumentsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app/chat" replace />} />
      </Routes>
    </Suspense>
  );
}
