import { useEffect, useState } from "react";
import { Icon, IconName } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { SourceControl } from "./SourceControl";
import { useStore } from "../state/store";
import { fs, DirEntry } from "../lib/tauri";
import { languageName } from "../editor/setup";

function iconFor(name: string): IconName {
  if (name.endsWith(".md")) return "markdown";
  if (/\.(ts|tsx|js|jsx|rs|py|css|html|json)$/.test(name)) return "code";
  return "file";
}

// Hide the .claude folder unless the user opts to show it.
function useVisibleFilter() {
  const showClaude = useStore((s) => s.settings.showClaudeFolder);
  return (entries: DirEntry[]) =>
    showClaude ? entries : entries.filter((e) => e.name !== ".claude");
}

function FsEntry({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const openFile = useStore((s) => s.openFile);
  // Boolean selector: only the rows whose active-ness changes re-render, not the
  // whole tree, when you open a file.
  const active = useStore((s) => s.activeFileId === entry.path);
  const filter = useVisibleFilter();

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
        className={`tree-row ${active ? "active" : ""}`}
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
          {filter(children).map((c) => (
            <FsEntry key={c.path} entry={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FsTree({ rootPath }: { rootPath: string }) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const filter = useVisibleFilter();
  useEffect(() => {
    fs.readDir(rootPath)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [rootPath]);

  if (!entries) return <div className="tree-hint">Loading…</div>;
  const visible = filter(entries);
  if (visible.length === 0) return <div className="tree-hint">Empty folder</div>;
  return (
    <>
      {visible.map((e) => (
        <FsEntry key={e.path} entry={e} depth={0} />
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
      {project?.path ? (
        <div className="file-tree">
          <FsTree rootPath={project.path} />
        </div>
      ) : (
        <div className="tree-hint">Add a folder from the left rail to start.</div>
      )}
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
        min={150}
        max={480}
        dir={1}
        onChange={setSidebarWidth}
      />
    </aside>
  );
}
