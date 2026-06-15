import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEMES, themeFromAccent, applyTheme } from "../styles/themes";

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
  blurEnabled: boolean;
  smoothCaret: boolean;
  lineNumbers: boolean;
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
  blurEnabled: true,
  smoothCaret: true,
  lineNumbers: true,
};

export type SidebarView = "explorer" | "scm";

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

interface AppState {
  settings: Settings;
  projects: Project[];
  activeProjectId: string | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  showPreview: boolean;
  showClaude: boolean;
  showSettings: boolean;
  showSidebar: boolean;
  showTerminal: boolean;
  splitView: boolean;
  splitFileId: string | null;
  splitWidth: number;
  welcomeDismissed: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;
  claudeWidth: number;
  terminalHeight: number;

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSidebarView: (v: SidebarView) => void;
  setSidebarWidth: (w: number) => void;
  setClaudeWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  setSplitFile: (id: string | null) => void;
  setSplitWidth: (w: number) => void;
  dismissWelcome: () => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  markSaved: (id: string) => void;
  addProject: (p: Project) => void;
  setActiveProject: (id: string) => void;
  openFile: (f: OpenFile) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  toggle: (
    key:
      | "showPreview"
      | "showClaude"
      | "showSettings"
      | "showSidebar"
      | "showTerminal"
      | "splitView"
  ) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      projects: [
        { id: "demo", name: "Welcome", path: "", color: "#7c8cff" },
      ],
      activeProjectId: "demo",
      openFiles: [],
      activeFileId: null,
      showPreview: false,
      showClaude: true,
      showSettings: false,
      showSidebar: true,
      showTerminal: false,
      splitView: false,
      splitFileId: null,
      splitWidth: 560,
      welcomeDismissed: false,
      sidebarView: "explorer",
      sidebarWidth: 240,
      claudeWidth: 420,
      terminalHeight: 240,

      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

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

      markSaved: (id) =>
        set((s) => ({
          openFiles: s.openFiles.map((f) =>
            f.id === id ? { ...f, dirty: false } : f
          ),
        })),

      addProject: (p) =>
        set((s) => ({ projects: [...s.projects, p], activeProjectId: p.id })),

      setActiveProject: (id) => set({ activeProjectId: id }),

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

      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<AppState>),
    }),
    {
      name: "anode-state",
      // Deep-merge settings so newly added fields (e.g. darkness, savedPalettes)
      // pick up their defaults for users with older persisted state.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
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
}
