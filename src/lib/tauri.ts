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
  readImageDataUrl: (path: string) =>
    invoke<string>("read_image_data_url", { path }),
};

// ---- Dialog --------------------------------------------------------------
export async function pickFolder(): Promise<string | null> {
  if (!inTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ directory: true, multiple: false });
  return typeof res === "string" ? res : null;
}

export async function pickImage(): Promise<string | null> {
  if (!inTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({
    multiple: false,
    filters: [{ name: "Image", extensions: ["png", "svg", "jpg", "jpeg", "gif", "webp", "ico"] }],
  });
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
  upstream: boolean;
}

export interface Commit {
  hash: string;
  short: string;
  author: string;
  date: string;
  subject: string;
}

export const git = {
  available: () => invoke<boolean>("git_available"),
  init: (path: string) => invoke<string>("git_init", { path }),
  info: (path: string) => invoke<GitInfo>("git_info", { path }),
  log: (path: string, limit = 20) => invoke<Commit[]>("git_log", { path, limit }),
  status: (path: string) => invoke<GitStatus>("git_status", { path }),
  pull: (path: string) => invoke<string>("git_pull", { path }),
  push: (path: string) => invoke<string>("git_push", { path }),
  publish: (path: string) => invoke<string>("git_publish", { path }),
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

// ---- Claude usage --------------------------------------------------------
// Token/cost totals for a project's most recent Claude Code session, read from
// its JSONL transcript under ~/.claude/projects (mirrors the Rust struct).
export interface ClaudeUsage {
  model: string;
  context_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  messages: number;
}

export const claudeUsage = (cwd: string) =>
  inTauri
    ? invoke<ClaudeUsage | null>("claude_usage", { cwd })
    : Promise.resolve(null);

// Raw text from `claude -p /usage` — the real subscription limits. Parsed by
// src/lib/claudeLimits.ts. Empty string outside Tauri / on failure.
export const claudeLimits = (cwd: string) =>
  inTauri ? invoke<string>("claude_limits", { cwd }) : Promise.resolve("");

// ---- Project stats -------------------------------------------------------
// Files / lines-of-code / size for the open folder, broken down by language
// (mirrors the Rust ProjectStats struct). Powers the Project Info dialog.
export interface LangStat {
  name: string;
  files: number;
  lines: number;
}
export interface ProjectStats {
  files: number;
  lines: number;
  bytes: number;
  dirs: number;
  languages: LangStat[];
}

export const projectStats = (path: string) =>
  invoke<ProjectStats>("project_stats", { path });

// ---- Window --------------------------------------------------------------
export const setBlur = (enabled: boolean) =>
  inTauri ? invoke<void>("set_blur", { enabled }) : Promise.resolve();

// ---- Pseudo-terminals ----------------------------------------------------
// Keyed by id: a "claude:<projectId>" runs Claude Code, "terminal:<projectId>"
// opens a shell. Each project keeps its own warm session (see WarmTerminals).
export const pty = {
  start: (
    id: string,
    program: string | null,
    args: string[] | null,
    cwd: string | null,
    cols: number,
    rows: number
  ) => invoke<void>("pty_start", { id, program, args, cwd, cols, rows }),
  write: (id: string, data: string) => invoke<void>("pty_write", { id, data }),
  resize: (id: string, cols: number, rows: number) =>
    invoke<void>("pty_resize", { id, cols, rows }),
  kill: (id: string) => invoke<void>("pty_kill", { id }),
};

// Subscribe to PTY output / exit (all sessions). Returns an unlisten function.
export async function onPtyOutput(cb: (id: string, chunk: string) => void) {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<{ id: string; chunk: string }>("pty://output", (e) =>
    cb(e.payload.id, e.payload.chunk)
  );
}
export async function onPtyExit(cb: (id: string) => void) {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("pty://exit", (e) => cb(e.payload));
}
