import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import {
  saveActiveFile,
  openFolderAsProject,
  closeActiveTab,
  editor,
} from "../lib/actions";
import { openUrl } from "../lib/tauri";

interface Item {
  label: string;
  shortcut?: string;
  run?: () => void;
  separator?: boolean;
}
interface Menu {
  label: string;
  items: Item[];
}

export function MenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = useStore((s) => s.toggle);
  const setSidebarView = useStore((s) => s.setSidebarView);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const menus: Menu[] = [
    {
      label: "File",
      items: [
        { label: "Open Folder…", run: openFolderAsProject },
        { label: "Save", shortcut: "Ctrl+S", run: saveActiveFile },
        { label: "Close Tab", shortcut: "Ctrl+W", run: closeActiveTab },
        { label: "Settings", shortcut: "Ctrl+,", separator: true, run: () => toggle("showSettings") },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", run: editor.undo },
        { label: "Redo", shortcut: "Ctrl+Y", run: editor.redo },
        { label: "Find", shortcut: "Ctrl+F", separator: true, run: editor.find },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Toggle Sidebar", shortcut: "Ctrl+B", run: () => toggle("showSidebar") },
        { label: "Split Editor", shortcut: "Ctrl+\\", run: () => toggle("splitView") },
        { label: "Toggle Markdown Preview", run: () => toggle("showPreview") },
        { label: "Toggle Claude Code", shortcut: "Ctrl+J", run: () => toggle("showClaude") },
        { label: "Explorer", separator: true, run: () => setSidebarView("explorer") },
        { label: "Source Control", run: () => setSidebarView("scm") },
      ],
    },
    {
      label: "Terminal",
      items: [
        { label: "Toggle Terminal", shortcut: "Ctrl+`", run: () => toggle("showTerminal") },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Claude Code docs", run: () => openUrl("https://docs.claude.com/claude-code") },
        { label: "Report an issue", run: () => openUrl("https://github.com/anthropics/claude-code/issues") },
      ],
    },
  ];

  return (
    <div className="menubar" ref={ref}>
      {menus.map((m) => (
        <div key={m.label} className="menu">
          <button
            className={`menu-label ${open === m.label ? "active" : ""}`}
            onClick={() => setOpen(open === m.label ? null : m.label)}
            onMouseEnter={() => open && setOpen(m.label)}
          >
            {m.label}
          </button>
          {open === m.label && (
            <div className="menu-pop">
              {m.items.map((it, i) => (
                <button
                  key={i}
                  className={`menu-item ${it.separator ? "sep" : ""}`}
                  onClick={() => {
                    setOpen(null);
                    it.run?.();
                  }}
                >
                  <span>{it.label}</span>
                  {it.shortcut && <span className="menu-key">{it.shortcut}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
