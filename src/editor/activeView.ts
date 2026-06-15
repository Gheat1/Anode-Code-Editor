import { EditorView } from "@codemirror/view";

// Tracks the currently focused editor (and the file it holds) so menu items and
// keybindings outside the editor (Undo/Redo/Find/Save) act on the right pane —
// important once the editor can be split into two.
let active: EditorView | null = null;
let activeFileId: string | null = null;

export const setActiveView = (v: EditorView | null, fileId: string | null = null) => {
  active = v;
  activeFileId = fileId;
};
export const getActiveView = () => active;
export const getActiveFileId = () => activeFileId;
