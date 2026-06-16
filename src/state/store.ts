import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { THEMES, themeFromAccent, applyTheme } from "../styles/themes";

// localStorage with debounced writes. The editor calls updateFileContent on
// every keystroke, and persist re-serializes the whole state (including open
// file contents) on each change — writing that to localStorage per keystroke is
// needless churn. Reads stay synchronous (so rehydrate is unaffected); only
// writes are coalesced, with a flush before the app closes so nothing is lost.
const debouncedLocalStorage: StateStorage = (() => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { name: string; value: string } | null = null;
  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (pending) {
      try {
        localStorage.setItem(pending.name, pending.value);
      } catch {
        /* quota exceeded / unavailable — drop this write rather than crash */
      }
      pending = null;
    }
  };
  if (typeof window !== "undefined") {
    // pagehide fires reliably when a webview/tab is torn down; beforeunload
    // covers the desktop close path.
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
  }
  return {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      pending = { name, value };
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, 350);
    },
    removeItem: (name) => {
      pending = null;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      localStorage.removeItem(name);
    },
  };
})();

// ---- Settings: one serializable blob. Account sync = push/pull this object.
// A user-saved palette that shows up alongside the built-in presets.
export interface SavedPalette {
  id: string;
  name: string;
  vars: Record<string, string>;
}

export interface Settings {
  themeId: string;
  customAccent: string | null; // when set, overrides themeId via palette chooser
  customBase: string;
  customTheme: Record<string, string> | null; // full hand-tuned palette (highest priority)
  savedPalettes: SavedPalette[]; // user palettes, synced with the rest of settings
  fontFamily: string;
  fontSize: number; // px, applies app-wide
  editorFontFamily: string;
  editorFontSize: number; // px, editor + terminals only
  lineHeight: number; // editor line height (unitless multiplier)
  blurEnabled: boolean;
  smoothCaret: boolean;
  lineNumbers: boolean;
  combinedSidebar: boolean; // show Explorer + Source Control stacked in one panel
  roundedCorners: boolean; // round the workspace panels (sidebar/editor/claude/terminal)
  notifications: boolean; // desktop notifications (Claude permission/ready, etc.)
  tabSize: number; // spaces per indent in the editor
  wordWrap: boolean; // soft-wrap long lines in the editor
  highlightActiveLine: boolean; // tint the line the caret is on
  autoCloseBrackets: boolean; // auto-insert the closing bracket/quote
  showClaudeFolder: boolean; // show the .claude folder in the explorer

  // Claude Code launch flags
  claudeSkipPermissions: boolean; // --dangerously-skip-permissions
  claudePermissionMode: "default" | "acceptEdits" | "plan"; // --permission-mode
  claudeModel: string; // --model (blank = CLI default)
  claudeContinue: boolean; // --continue
  claudeVerbose: boolean; // --verbose
  claudeExtraFlags: string; // appended raw

  // Overlay a chat-style UI on top of the live Claude terminal. The real
  // terminal keeps running underneath (so every slash command still works);
  // toggle off to use it raw. See ClaudeChat / ClaudePanel.
  claudeChatUi: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  themeId: "midnight",
  customAccent: null,
  customBase: "#0e0e12",
  customTheme: null,
  savedPalettes: [],
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 14,
  editorFontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
  editorFontSize: 13.5,
  lineHeight: 1.7,
  blurEnabled: false, // acrylic removed for performance (window is opaque)
  smoothCaret: true,
  lineNumbers: true,
  combinedSidebar: false,
  roundedCorners: false,
  notifications: true,
  tabSize: 2,
  wordWrap: true,
  highlightActiveLine: true,
  autoCloseBrackets: true,
  showClaudeFolder: false,
  claudeSkipPermissions: false,
  claudePermissionMode: "default",
  claudeModel: "",
  claudeContinue: false,
  claudeVerbose: false,
  claudeExtraFlags: "",
  claudeChatUi: true,
};

export type SidebarView = "explorer" | "scm";

// How many projects keep their Claude/terminal PTY sessions alive in the
// background. Switching back to a warm project is instant (no reboot); older
// ones are torn down to cap memory. See WarmTerminals.tsx.
export const WARM_CAP = 3;

// Move `id` to the front of the recency list, dedupe, and cap the length.
function bumpWarm(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, WARM_CAP);
}

// ---- Workspace: projects, open files, active selection.
export interface Project {
  id: string;
  name: string;
  path: string;
  color: string; // tint behind the icon
  icon?: string; // emoji char, or a data: URL for an uploaded png/svg
}

export interface OpenFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  dirty: boolean;
}

// Per-project snapshot of which files are open, so switching projects restores
// the tabs you had there last (and they persist across restarts).
export interface ProjectSession {
  openFiles: OpenFile[];
  activeFileId: string | null;
}

interface AppState {
  settings: Settings;
  projects: Project[];
  activeProjectId: string | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  sessions: Record<string, ProjectSession>; // open files per project id
  warmProjectIds: string[]; // recently-active projects whose PTYs stay warm (LRU)
  showPreview: boolean;
  showClaude: boolean;
  showSettings: boolean;
  showSidebar: boolean;
  showTerminal: boolean;
  showAbout: boolean;
  showProjectInfo: boolean; // Project Info dialog (files / lines of code / size)
  terminalRestart: number; // bump to start a fresh shell in the active project
  // Live status of the active project's Claude session, surfaced so the activity
  // bar can show a running/busy indicator even when the panel is closed.
  claudeRunning: boolean;
  claudeBusy: boolean;
  splitView: boolean;
  splitFileId: string | null;
  splitWidth: number;
  welcomeDismissed: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;
  claudeWidth: number;
  terminalHeight: number;
  switching: boolean; // true while a project switch is masked by the loading overlay
  pendingProjectId: string | null;
  accountEmail: string | null; // signed-in Anode account (null = signed out)
  settingsSection: string; // active section in the Settings panel

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setAccountEmail: (email: string | null) => void;
  setSettingsSection: (section: string) => void;
  openSettingsAt: (section: string) => void;
  switchProject: (id: string) => void;
  finishSwitch: () => void;
  setSidebarView: (v: SidebarView) => void;
  setSidebarWidth: (w: number) => void;
  setClaudeWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  setSplitFile: (id: string | null) => void;
  setSplitWidth: (w: number) => void;
  dismissWelcome: () => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  markSaved: (id: string) => void;
  addProject: (p: Project) => void;
  setActiveProject: (id: string) => void;
  openFile: (f: OpenFile) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  newTerminal: () => void; // open the terminal and start a fresh shell
  setClaudeStatus: (running: boolean, busy: boolean) => void;
  toggle: (
    key:
      | "showPreview"
      | "showClaude"
      | "showSettings"
      | "showSidebar"
      | "showTerminal"
      | "showAbout"
      | "showProjectInfo"
      | "splitView"
  ) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      projects: [{ id: "home", name: "Home", path: "", color: "#7c8cff" }],
      activeProjectId: "home",
      openFiles: [],
      activeFileId: null,
      sessions: {},
      warmProjectIds: ["home"],
      showPreview: false,
      showClaude: true,
      showSettings: false,
      showSidebar: true,
      showTerminal: false,
      showAbout: false,
      showProjectInfo: false,
      terminalRestart: 0,
      claudeRunning: false,
      claudeBusy: false,
      splitView: false,
      splitFileId: null,
      splitWidth: 560,
      welcomeDismissed: false,
      sidebarView: "explorer",
      sidebarWidth: 240,
      claudeWidth: 420,
      terminalHeight: 240,
      switching: false,
      pendingProjectId: null,
      accountEmail: null,
      settingsSection: "appearance",

      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

      setAccountEmail: (email) => set({ accountEmail: email }),
      setSettingsSection: (section) => set({ settingsSection: section }),
      openSettingsAt: (section) =>
        set({ showSettings: true, settingsSection: section }),

      // Request a masked project switch (App applies it on the next frame, behind
      // the grey loading overlay, so the heavy remount jank isn't visible).
      switchProject: (id) =>
        set((s) =>
          s.activeProjectId === id || s.pendingProjectId === id
            ? {}
            : { switching: true, pendingProjectId: id }
        ),
      finishSwitch: () => set({ switching: false, pendingProjectId: null }),

      setSidebarView: (v) => set({ sidebarView: v }),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setClaudeWidth: (w) => set({ claudeWidth: w }),
      setTerminalHeight: (h) => set({ terminalHeight: h }),
      setSplitFile: (id) => set({ splitFileId: id }),
      setSplitWidth: (w) => set({ splitWidth: w }),
      dismissWelcome: () => set({ welcomeDismissed: true }),
      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),

      removeProject: (id) =>
        set((s) => {
          const remaining = s.projects.filter((p) => p.id !== id);
          // Drop the removed project's saved tabs so it doesn't linger in memory
          // or get restored if a folder with the same id is re-added later.
          const { [id]: _gone, ...sessions } = s.sessions;
          const warmProjectIds = s.warmProjectIds.filter((pid) => pid !== id);

          // Removing a background project: nothing else to touch.
          if (s.activeProjectId !== id) {
            return { projects: remaining, sessions, warmProjectIds };
          }

          // Removing the *active* project: switch to the next remaining one and
          // restore its tabs, otherwise the editor keeps showing the deleted
          // project's files. May be null if the user removed the last project.
          const nextId = remaining[0]?.id ?? null;
          const restored =
            (nextId && sessions[nextId]) || { openFiles: [], activeFileId: null };
          return {
            projects: remaining,
            sessions,
            warmProjectIds: nextId ? bumpWarm(warmProjectIds, nextId) : warmProjectIds,
            activeProjectId: nextId,
            openFiles: restored.openFiles,
            activeFileId: restored.activeFileId,
            splitFileId: null,
          };
        }),

      markSaved: (id) =>
        set((s) => ({
          openFiles: s.openFiles.map((f) =>
            f.id === id ? { ...f, dirty: false } : f
          ),
        })),

      addProject: (p) =>
        set((s) => ({
          projects: [...s.projects, p],
          // Save the current project's tabs, open the new one empty.
          sessions: {
            ...s.sessions,
            ...(s.activeProjectId
              ? { [s.activeProjectId]: { openFiles: s.openFiles, activeFileId: s.activeFileId } }
              : {}),
          },
          activeProjectId: p.id,
          warmProjectIds: bumpWarm(s.warmProjectIds, p.id),
          openFiles: [],
          activeFileId: null,
          splitFileId: null,
        })),

      setActiveProject: (id) =>
        set((s) => {
          if (id === s.activeProjectId) return {};
          // Snapshot the project we're leaving, restore the one we're entering.
          const sessions = {
            ...s.sessions,
            ...(s.activeProjectId
              ? { [s.activeProjectId]: { openFiles: s.openFiles, activeFileId: s.activeFileId } }
              : {}),
          };
          const restored = sessions[id] ?? { openFiles: [], activeFileId: null };
          return {
            sessions,
            activeProjectId: id,
            warmProjectIds: bumpWarm(s.warmProjectIds, id),
            openFiles: restored.openFiles,
            activeFileId: restored.activeFileId,
            splitFileId: null,
          };
        }),

      openFile: (f) =>
        set((s) =>
          s.openFiles.some((o) => o.id === f.id)
            ? { activeFileId: f.id }
            : { openFiles: [...s.openFiles, f], activeFileId: f.id }
        ),

      closeFile: (id) =>
        set((s) => {
          const openFiles = s.openFiles.filter((f) => f.id !== id);
          const activeFileId =
            s.activeFileId === id
              ? openFiles[openFiles.length - 1]?.id ?? null
              : s.activeFileId;
          return { openFiles, activeFileId };
        }),

      setActiveFile: (id) => set({ activeFileId: id }),

      updateFileContent: (id, content) =>
        set((s) => ({
          openFiles: s.openFiles.map((f) =>
            f.id === id ? { ...f, content, dirty: true } : f
          ),
        })),

      // Reveal the terminal panel and bump the restart counter so the active
      // project's shell is torn down and respawned fresh (see TerminalPanel).
      newTerminal: () =>
        set((s) => ({ showTerminal: true, terminalRestart: s.terminalRestart + 1 })),

      setClaudeStatus: (running, busy) =>
        set((s) =>
          s.claudeRunning === running && s.claudeBusy === busy
            ? {}
            : { claudeRunning: running, claudeBusy: busy }
        ),

      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<AppState>),
    }),
    {
      name: "anode-state",
      version: 1,
      storage: createJSONStorage(() => debouncedLocalStorage),
      // v1: drop the legacy "Welcome" demo project and welcome/scratch files
      // that lingered in saved state after they were removed from the app.
      migrate: (persisted, version) => {
        const p = persisted as any;
        if (version < 1 && p && typeof p === "object") {
          if (Array.isArray(p.openFiles)) {
            p.openFiles = p.openFiles.filter(
              (f: any) => f?.id !== "welcome.md" && f?.id !== "scratch.ts"
            );
          }
          if (Array.isArray(p.projects)) {
            p.projects = p.projects.filter((pr: any) => pr?.id !== "demo");
            if (p.projects.length === 0) {
              p.projects = [{ id: "home", name: "Home", path: "", color: "#7c8cff" }];
            }
          }
          if (p.activeProjectId === "demo") p.activeProjectId = "home";
          if (p.activeFileId === "welcome.md" || p.activeFileId === "scratch.ts") {
            p.activeFileId = p.openFiles?.[0]?.id ?? null;
          }
        }
        return p;
      },
      // Deep-merge settings so newly added fields pick up their defaults for
      // users with older persisted state.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          // No PTY survives a restart, so the warm pool starts with just the
          // active project; others warm up again as you visit them.
          warmProjectIds: [p.activeProjectId ?? "home"],
          // Never restore a mid-switch overlay state from disk.
          switching: false,
          pendingProjectId: null,
          // Transient modals — don't reopen these dialogs on launch.
          showAbout: false,
          showProjectInfo: false,
          // Re-validated against the token at startup (App), so start blank.
          accountEmail: null,
        };
      },
    }
  )
);

// Re-apply theme + global font whenever settings change. Subscribing here keeps
// the side effect in one place instead of scattered across components.
export function syncAppearance(settings: Settings) {
  // Priority: fully hand-tuned palette > accent-derived palette > named preset.
  const base = settings.customTheme
    ? settings.customTheme
    : settings.customAccent
    ? themeFromAccent(settings.customAccent, settings.customBase)
    : THEMES.find((t) => t.id === settings.themeId)?.vars ?? THEMES[0].vars;
  applyTheme(base);

  const root = document.documentElement;
  root.style.setProperty("--app-font", settings.fontFamily);
  root.style.setProperty("--editor-font", settings.editorFontFamily);
  root.style.setProperty("--app-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--editor-font-size", `${settings.editorFontSize}px`);
  root.style.setProperty("--editor-line-height", `${settings.lineHeight}`);

  // Rounded-panel mode: a body class drives the CSS that insets the workspace
  // panels and rounds them so they read as one cohesive set of cards.
  document.body.classList.toggle("rounded-ui", settings.roundedCorners);
}
