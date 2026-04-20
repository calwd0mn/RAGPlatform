import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: "stats.html",
    }),
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 202400, // 体积大于 10KB 的文件才会被压缩（antd 包远超于此，100% 命中压缩）
      algorithm: "gzip",
      ext: ".gz",
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // 👇 新增 build 配置进行分包
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            // 1. 优先提取 React 核心源码（必须放在最前面，防止被其他规则误伤导致 undefined）
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react-router")
            ) {
              return "vendor-react";
            }
            // 2. 提取并隔离富文本和 PDF 重型引擎
            if (id.includes("react-pdf") || id.includes("pdfjs-dist")) {
              return "vendor-pdf";
            }
            if (
              id.includes("react-markdown") ||
              id.includes("remark") ||
              id.includes("rehype")
            ) {
              return "vendor-markdown";
            }

            // 🎯 极致首屏优化：彻底删除 `vendor-antd` 的全量打包规则！
            // 之前我们把所有的 antd 和 rc- 都打进了 vendor-antd，导致登录页被迫下载了根本不用的 Table、DatePicker 等重型组件。
            // 现在我们删掉它，把 Antd 的拆包权力完全交给 Vite 原生的 ESM 依赖树分析！
            // Vite 会自动把登录页用到的（Button/Form）放在公用 chunk，把知识库页面用到的（Table）放在独立 chunk！

            // ⚡️ 关键修复：不要强行把剩下的包一锅端放入 vendor-core
            // 让 Vite 底层的 Rollup引擎根据依赖图谱自动进行智能依赖分析和切割！
          }
        },
      },
    },
    // 将分包大小警告阈值适当提高（因为像 Antd 这种重量级 UI 库本身就大，Gzip 之后很小，不需要强行切碎）
    chunkSizeWarningLimit: 1000,
    target: "esnext",
  },

  optimizeDeps: {
    include: ["antd", "@ant-design/icons"],
  },
});
