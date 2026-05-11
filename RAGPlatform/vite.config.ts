import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer"

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

export default defineConfig({
  plugins: [react(),
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
