import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../../layouts/AppLayout";
import { AuthLayout } from "../../layouts/AuthLayout";
import { ChatWorkbenchPage } from "../../pages/chat/ChatWorkbenchPage";

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
const WorkflowPage = lazy(() =>
  import("../../pages/workflow/WorkflowPage").then((module) => ({
    default: module.WorkflowPage,
  })),
);

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <Suspense fallback={null}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/register"
          element={
            <Suspense fallback={null}>
              <RegisterPage />
            </Suspense>
          }
        />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/chat" replace />} />
          <Route path="chat" element={<ChatWorkbenchPage />} />
          <Route path="chat/:conversationId" element={<ChatWorkbenchPage />} />
          <Route
            path="documents"
            element={
              <Suspense fallback={null}>
                <DocumentsPage />
              </Suspense>
            }
          />
          <Route
            path="workflow"
            element={
              <Suspense fallback={null}>
                <WorkflowPage />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app/chat" replace />} />
    </Routes>
  );
}
