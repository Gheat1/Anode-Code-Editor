import { undo, redo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { useStore } from "../state/store";
import { getActiveView, getActiveFileId } from "../editor/activeView";
import { fs, pickFolder, inTauri } from "./tauri";

const PROJECT_COLORS = ["#7c8cff", "#6bdc9b", "#ffce6b", "#ff6b9d", "#88c0d0"];

// Persist the active file to disk. Demo/welcome files have no real path, so
// they're skipped (nothing to write to yet).
export async function saveActiveFile() {
  const s = useStore.getState();
  // Prefer the focused editor pane (matters in split view), fall back to the tab.
  const fid = getActiveFileId() ?? s.activeFileId;
  const f = s.openFiles.find((o) => o.id === fid);
  if (!f) return;
  if (!inTauri || !/[\\/]/.test(f.path)) return;
  try {
    await fs.writeFile(f.path, f.content);
    s.markSaved(f.id);
  } catch {
    /* surface via a toast later */
  }
}

export async function openFolderAsProject() {
  const dir = await pickFolder();
  if (!dir) return;
  const s = useStore.getState();
  const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
  s.addProject({
    id: dir,
    name,
    path: dir,
    color: PROJECT_COLORS[s.projects.length % PROJECT_COLORS.length],
  });
}

export function closeActiveTab() {
  const s = useStore.getState();
  if (s.activeFileId) s.closeFile(s.activeFileId);
}

// Editor commands routed to the focused CodeMirror instance.
export const editor = {
  undo: () => {
    const v = getActiveView();
    if (v) {
      undo(v);
      v.focus();
    }
  },
  redo: () => {
    const v = getActiveView();
    if (v) {
      redo(v);
      v.focus();
    }
  },
  find: () => {
    const v = getActiveView();
    if (v) {
      openSearchPanel(v);
    }
  },
};
