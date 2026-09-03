import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
	const backendUrl = env.BACKEND_URL ?? 'http://localhost:8080';

  const basicAuthUser = env.BASIC_AUTH_USERNAME ?? 'admin';
  const basicAuthPass = env.BASIC_AUTH_PASSWORD;
  const proxyHeaders = basicAuthPass
    ? {
        Authorization:
          'Basic ' +
          Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64'),
      }
    : undefined;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      proxy: {
        '^/api/': {
          target: backendUrl,
          changeOrigin: true,
          headers: proxyHeaders,
        },
      },
    },
  }
})
