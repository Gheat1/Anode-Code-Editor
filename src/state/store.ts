import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEMES, themeFromAccent, applyTheme } from "../styles/themes";

// ---- Settings: one serializable blob. Account sync = push/pull this object.
export interface Settings {
  themeId: string;
  customAccent: string | null; // when set, overrides themeId via palette chooser
  customBase: string;
  customTheme: Record<string, string> | null; // full hand-tuned palette (highest priority)
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
  color: string; // tint behind the monochrome icon
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
  sidebarView: SidebarView;
  sidebarWidth: number;
  claudeWidth: number;

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setSidebarView: (v: SidebarView) => void;
  setSidebarWidth: (w: number) => void;
  setClaudeWidth: (w: number) => void;
  addProject: (p: Project) => void;
  setActiveProject: (id: string) => void;
  openFile: (f: OpenFile) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  toggle: (key: "showPreview" | "showClaude" | "showSettings") => void;
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
      sidebarView: "explorer",
      sidebarWidth: 240,
      claudeWidth: 420,

      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

      setSidebarView: (v) => set({ sidebarView: v }),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setClaudeWidth: (w) => set({ claudeWidth: w }),

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
    { name: "anode-state" }
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
