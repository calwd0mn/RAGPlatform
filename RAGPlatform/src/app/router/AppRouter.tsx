import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../../layouts/AppLayout";
import { AuthLayout } from "../../layouts/AuthLayout";
import { ChatWorkbenchPage } from "../../pages/chat/ChatWorkbenchPage";
import { DebugWorkbenchPage } from "../../pages/debug/DebugWorkbenchPage";
import { DocumentsPage } from "../../pages/documents/DocumentsPage";
import { LoginPage } from "../../pages/login/LoginPage";
import { RegisterPage } from "../../pages/register/RegisterPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/chat" replace />} />
          <Route path="chat" element={<ChatWorkbenchPage />} />
          <Route path="chat/:conversationId" element={<ChatWorkbenchPage />} />
          <Route path="debug" element={<DebugWorkbenchPage />} />
          <Route path="documents" element={<DocumentsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app/chat" replace />} />
    </Routes>
  );
}
