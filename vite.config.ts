import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    optimizeDeps: {
      noDiscovery: true,
      include: ["react", "react-dom", "react-dom/client", "react-router-dom", "zod"],
      holdUntilCrawlEnd: false,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test-setup.ts",
    },
    preview: {
      proxy: {
        "/api": apiProxyTarget,
      },
    },
    server: {
      proxy: {
        "/api": apiProxyTarget,
      },
    },
  };
});
