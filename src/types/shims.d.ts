/// <reference types="vite/client" />

// markdown-it plugins without bundled types.
declare module "markdown-it-task-lists" {
  import { PluginWithOptions } from "markdown-it";
  const plugin: PluginWithOptions<{ enabled?: boolean; label?: boolean; labelAfter?: boolean }>;
  export default plugin;
}
