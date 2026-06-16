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
}
interface Menu {
  label: string;
  items: Item[];
}

// The app's single menu. Clicking the brand (◆ Anode) opens one dropdown that
// groups File/Edit/View/Terminal/Help — replacing the old row of menu buttons
// in the title bar. Closes on outside click / Escape.
export function BrandMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = useStore((s) => s.toggle);
  const newTerminal = useStore((s) => s.newTerminal);
  const setSidebarView = useStore((s) => s.setSidebarView);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
        { label: "Project Info…", run: () => toggle("showProjectInfo") },
        { label: "Settings", shortcut: "Ctrl+,", run: () => toggle("showSettings") },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", run: editor.undo },
        { label: "Redo", shortcut: "Ctrl+Y", run: editor.redo },
        { label: "Cut", run: editor.cut },
        { label: "Copy", run: editor.copy },
        { label: "Paste", run: editor.paste },
        { label: "Find", shortcut: "Ctrl+F", run: editor.find },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Toggle Sidebar", shortcut: "Ctrl+B", run: () => toggle("showSidebar") },
        { label: "Split Editor", shortcut: "Ctrl+\\", run: () => toggle("splitView") },
        { label: "Toggle Markdown Preview", run: () => toggle("showPreview") },
        { label: "Toggle Claude Code", shortcut: "Ctrl+J", run: () => toggle("showClaude") },
        { label: "Explorer", run: () => setSidebarView("explorer") },
        { label: "Source Control", run: () => setSidebarView("scm") },
      ],
    },
    {
      label: "Terminal",
      items: [
        { label: "Toggle Terminal", shortcut: "Ctrl+`", run: () => toggle("showTerminal") },
        { label: "New Terminal", run: newTerminal },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Claude Code docs", run: () => openUrl("https://docs.claude.com/claude-code") },
        { label: "Report an issue", run: () => openUrl("https://github.com/anthropics/claude-code/issues") },
        { label: "About Anode", run: () => toggle("showAbout") },
      ],
    },
  ];

  return (
    <div className="brand-menu" ref={ref}>
      <button
        className={`brand ${open ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Menu"
      >
        <span className="mark">◆</span> Anode
      </button>
      {open && (
        <div className="brand-pop">
          {menus.map((m) => (
            <div key={m.label} className="brand-group">
              <div className="brand-group-label">{m.label}</div>
              {m.items.map((it, i) => (
                <button
                  key={i}
                  className="menu-item"
                  onClick={() => {
                    setOpen(false);
                    it.run?.();
                  }}
                >
                  <span>{it.label}</span>
                  {it.shortcut && <span className="menu-key">{it.shortcut}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
