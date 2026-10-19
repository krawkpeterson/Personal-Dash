import { defineConfig } from "vite";
import { resolve } from "node:path";

const API_PORT = Number(process.env.KRAWK_API_PORT ?? 8787);

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        play: resolve(import.meta.dirname, "play.html"),
        seth: resolve(import.meta.dirname, "seth.html"),
      },
    },
  },
});
