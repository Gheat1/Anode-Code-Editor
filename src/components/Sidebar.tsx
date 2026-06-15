import { useEffect, useState } from "react";
import { Icon, IconName } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { SourceControl } from "./SourceControl";
import { useStore } from "../state/store";
import { WELCOME_FILES } from "../data/welcome";
import { fs, DirEntry } from "../lib/tauri";
import { languageName } from "../editor/setup";

function iconFor(name: string): IconName {
  if (name.endsWith(".md")) return "markdown";
  if (/\.(ts|tsx|js|jsx|rs|py|css|html|json)$/.test(name)) return "code";
  return "file";
}

// ---- Real filesystem tree (lazy: folders load children on expand) ---------
function FsEntry({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const openFile = useStore((s) => s.openFile);
  const activeFileId = useStore((s) => s.activeFileId);

  async function onClick() {
    if (entry.is_dir) {
      const next = !open;
      setOpen(next);
      if (next && children === null) {
        try {
          setChildren(await fs.readDir(entry.path));
        } catch {
          setChildren([]);
        }
      }
      return;
    }
    try {
      const content = await fs.readFile(entry.path);
      openFile({
        id: entry.path,
        name: entry.name,
        path: entry.path,
        language: languageName(entry.name),
        content,
        dirty: false,
      });
    } catch {
      /* unreadable (binary, perms) — ignore */
    }
  }

  return (
    <div>
      <div
        className={`tree-row ${activeFileId === entry.path ? "active" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={onClick}
      >
        {entry.is_dir ? (
          <span className={`chev ${open ? "open" : ""}`}>
            <Icon name="chevron" size={13} />
          </span>
        ) : (
          <span style={{ width: 13 }} />
        )}
        <Icon
          name={entry.is_dir ? (open ? "folderOpen" : "folder") : iconFor(entry.name)}
          size={16}
        />
        <span>{entry.name}</span>
      </div>
      {open && children && (
        <div className="tree-children">
          {children.map((c) => (
            <FsEntry key={c.path} entry={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FsTree({ rootPath }: { rootPath: string }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  useEffect(() => {
    fs.readDir(rootPath)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [rootPath]);

  if (!entries) return <div className="tree-hint">Loading…</div>;
  if (entries.length === 0) return <div className="tree-hint">Empty folder</div>;
  return (
    <>
      {entries.map((e) => (
        <FsEntry key={e.path} entry={e} depth={0} />
      ))}
    </>
  );
}

// ---- Demo tree (used when the active project has no real path) -------------
function DemoTree() {
  const openFile = useStore((s) => s.openFile);
  const activeFileId = useStore((s) => s.activeFileId);
  const welcomeDismissed = useStore((s) => s.welcomeDismissed);
  if (welcomeDismissed) {
    return <div className="tree-hint">Add a folder from the left rail to start.</div>;
  }
  return (
    <>
      {Object.values(WELCOME_FILES).map((f) => (
        <div
          key={f.id}
          className={`tree-row ${activeFileId === f.id ? "active" : ""}`}
          style={{ paddingLeft: 8 }}
          onClick={() => openFile(f)}
        >
          <span style={{ width: 13 }} />
          <Icon name={iconFor(f.name)} size={16} />
          <span>{f.name}</span>
        </div>
      ))}
    </>
  );
}

function ExplorerView() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  return (
    <>
      <div className="sb-head">
        <span>{project?.name ?? "Explorer"}</span>
      </div>
      <div className="file-tree">
        {project?.path ? <FsTree rootPath={project.path} /> : <DemoTree />}
      </div>
    </>
  );
}

export function Sidebar() {
  const sidebarView = useStore((s) => s.sidebarView);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);

  return (
    <aside className="sidebar" style={{ width: sidebarWidth }}>
      {sidebarView === "explorer" ? <ExplorerView /> : <SourceControl />}
      <ResizeHandle
        side="right"
        value={sidebarWidth}
        min={180}
        max={480}
        dir={1}
        onChange={setSidebarWidth}
      />
    </aside>
  );
}
