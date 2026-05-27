import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
const shouldAnalyze = process.env.ANALYZE === "true";
const immutableCacheControl = "public, max-age=31536000, immutable";
const revalidateCacheControl = "no-cache";

function getPreviewCacheControl(requestUrl: string | undefined): string {
  const pathname = new URL(requestUrl ?? "/", "http://localhost").pathname;

  if (pathname.startsWith("/assets/")) {
    return immutableCacheControl;
  }

  return revalidateCacheControl;
}

function previewCacheHeaders(): Plugin {
  return {
    name: "ragplatform-preview-cache-headers",
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        response.setHeader("Cache-Control", getPreviewCacheControl(request.url));
        next();
      });
    },
  };
}

function manualVendorChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("@xyflow/react")) {
    return "vendor-workflow";
  }

  if (id.includes("react-pdf") || id.includes("pdfjs-dist")) {
    return "vendor-pdf";
  }

  if (
    id.includes("react-markdown") ||
    id.includes("remark-gfm") ||
    id.includes("micromark") ||
    id.includes("unified")
  ) {
    return "vendor-markdown";
  }

  if (id.includes("react-router-dom")) {
    return "vendor-router";
  }

  if (
    id.includes("@tanstack/react-query") ||
    id.includes("axios") ||
    id.includes("zustand")
  ) {
    return "vendor-data";
  }

  if (
    id.includes("node_modules/react/") ||
    id.includes("node_modules/react-dom/")
  ) {
    return "vendor-react";
  }

  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    previewCacheHeaders(),
    shouldAnalyze &&
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: true,
      }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: manualVendorChunks,
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
