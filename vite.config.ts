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
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy libraries into their own chunks so the initial bundle is
        // small and the webview parses less up front. xterm/markdown load only
        // when their lazy components mount.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@codemirror") || id.includes("@lezer")) return "codemirror";
          if (id.includes("xterm")) return "xterm";
          if (
            id.includes("markdown-it") ||
            id.includes("linkify") ||
            id.includes("entities") ||
            id.includes("mdurl") ||
            id.includes("uc.micro") ||
            id.includes("punycode")
          )
            return "markdown";
          if (id.includes("react") || id.includes("scheduler")) return "react";
          if (id.includes("zustand")) return "state";
          return "vendor";
        },
      },
    },
  },
});
