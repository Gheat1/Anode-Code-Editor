// Thin wrappers around the Rust commands. Guarded so the UI still runs in a
// plain browser (vite dev in a tab) where the Tauri bridge is absent.
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export const inTauri = "__TAURI_INTERNALS__" in window;

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inTauri) {
    throw new Error(`Tauri command "${cmd}" is unavailable outside the desktop app`);
  }
  return tauriInvoke<T>(cmd, args);
}

// ---- Filesystem ----------------------------------------------------------
export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export const fs = {
  readDir: (path: string) => invoke<DirEntry[]>("read_dir", { path }),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  writeFile: (path: string, contents: string) =>
    invoke<void>("write_file", { path, contents }),
};

// ---- Dialog --------------------------------------------------------------
export async function pickFolder(): Promise<string | null> {
  if (!inTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ directory: true, multiple: false });
  return typeof res === "string" ? res : null;
}

// ---- Git -----------------------------------------------------------------
export interface GitStatus {
  branch: string;
  dirty: boolean;
  files: string[];
}

export interface GitFile {
  path: string;
  status: string; // porcelain XY code, e.g. "M", "??", "A"
}

export interface GitInfo {
  is_repo: boolean;
  branch: string;
  has_commits: boolean;
  files: GitFile[];
  ahead: number;
  behind: number;
  remote: string | null;
}

export const git = {
  available: () => invoke<boolean>("git_available"),
  init: (path: string) => invoke<string>("git_init", { path }),
  info: (path: string) => invoke<GitInfo>("git_info", { path }),
  status: (path: string) => invoke<GitStatus>("git_status", { path }),
  pull: (path: string) => invoke<string>("git_pull", { path }),
  push: (path: string) => invoke<string>("git_push", { path }),
  commitAll: (path: string, message: string) =>
    invoke<string>("git_commit_all", { path, message }),
};

// ---- GitHub auth ---------------------------------------------------------
export interface DeviceStart {
  user_code: string;
  verification_uri: string;
  device_code: string;
  interval: number;
}

export const github = {
  deviceStart: () => invoke<DeviceStart>("github_device_start"),
  devicePoll: (deviceCode: string) =>
    invoke<string | null>("github_device_poll", { deviceCode }),
  user: () => invoke<string | null>("github_user"),
  logout: () => invoke<void>("github_logout"),
};

export const openUrl = (url: string) =>
  inTauri ? invoke<void>("open_url", { url }) : Promise.resolve();

// ---- Window --------------------------------------------------------------
export const setBlur = (enabled: boolean) =>
  inTauri ? invoke<void>("set_blur", { enabled }) : Promise.resolve();

// ---- Claude Code (PTY) ---------------------------------------------------
export const claudeCli = {
  start: (cwd: string | null, cols: number, rows: number) =>
    invoke<void>("claude_start", { cwd, cols, rows }),
  write: (data: string) => invoke<void>("claude_write", { data }),
  resize: (cols: number, rows: number) =>
    invoke<void>("claude_resize", { cols, rows }),
  kill: () => invoke<void>("claude_kill"),
};

// Subscribe to PTY output / exit. Returns an unlisten function.
export async function onClaudeOutput(cb: (chunk: string) => void) {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("claude://output", (e) => cb(e.payload));
}
export async function onClaudeExit(cb: () => void) {
  const { listen } = await import("@tauri-apps/api/event");
  return listen("claude://exit", () => cb());
}
