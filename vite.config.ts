import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and ignores the Vite HMR websocket host on 1420.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't watch the Rust side; cargo handles that.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Produce a build the WebView2 runtime can consume.
  build: {
    target: "chrome105",
    minify: "esbuild",
    sourcemap: false,
  },
});
