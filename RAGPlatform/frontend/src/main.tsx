import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProviders } from "./app/providers/AppProviders";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* 通过组件式创建browser路由，而不是使用createBrowserRouter */}
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
