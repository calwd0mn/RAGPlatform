import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Flex, Spin } from "antd";
import { useAuth } from "../../hooks/useAuth";

export function ProtectedRoute() {
  const location = useLocation();
  const { authStatus } = useAuth();
  const VITE_DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

  if (VITE_DEV_BYPASS_AUTH) {
    return <Outlet />;
  }

  if (authStatus === "idle" || authStatus === "loading") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" tip="正在验证登录状态..." />
      </Flex>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
