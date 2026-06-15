import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useStore } from "../state/store";
import { languageName } from "../editor/setup";
import { git, inTauri } from "../lib/tauri";

// Same rules as the demo linter, so the title-bar counts match the underlines.
function countDiagnostics(text: string) {
  let errors = 0;
  let warnings = 0;
  for (const line of text.split("\n")) {
    if (/console\.log/.test(line)) errors++;
    if (/\b(TODO|FIXME|XXX)\b/.test(line)) warnings++;
  }
  return { errors, warnings };
}

// Custom frameless title bar. It carries the app brand, the active file +
// language, live diagnostics, and the git branch — so there's no separate
// (VS-Code-like) status bar. The bar is draggable; buttons opt out.
export function TitleBar() {
  const file = useStore((s) => s.openFiles.find((f) => f.id === s.activeFileId));
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!inTauri || !project?.path) {
      setBranch(null);
      return;
    }
    git
      .status(project.path)
      .then((s) => setBranch(s.branch))
      .catch(() => setBranch(null));
  }, [project?.path]);

  const { errors, warnings } = file
    ? countDiagnostics(file.content)
    : { errors: 0, warnings: 0 };

  async function win(action: "minimize" | "maximize" | "close") {
    if (!inTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    if (action === "minimize") await w.minimize();
    if (action === "maximize") await w.toggleMaximize();
    if (action === "close") await w.close();
  }

  return (
    <header className="titlebar">
      <span className="brand">
        <span className="mark">◆</span> Anode
      </span>

      {file && (
        <span className="tb-file">
          {file.name}
          {file.dirty && <span className="tb-dot">●</span>}
          <span className="tb-lang">{languageName(file.name)}</span>
        </span>
      )}

      <span className="spacer" />

      {file && (errors > 0 || warnings > 0) && (
        <span className="tb-diag">
          {errors > 0 && (
            <span className="err">
              <Icon name="error" size={13} /> {errors}
            </span>
          )}
          {warnings > 0 && (
            <span className="warn">
              <Icon name="warning" size={13} /> {warnings}
            </span>
          )}
        </span>
      )}

      {branch && (
        <span className="tb-branch">
          <Icon name="git" size={13} /> {branch}
        </span>
      )}

      <div className="win-btns">
        <button onClick={() => win("minimize")} title="Minimize">
          <Icon name="minimize" size={15} />
        </button>
        <button onClick={() => win("maximize")} title="Maximize">
          <Icon name="maximize" size={13} />
        </button>
        <button className="close" onClick={() => win("close")} title="Close">
          <Icon name="close" size={15} />
        </button>
      </div>
    </header>
  );
}
