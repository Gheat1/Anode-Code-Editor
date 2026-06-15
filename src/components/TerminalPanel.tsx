import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { XtermView } from "./XtermView";
import { useStore } from "../state/store";
import { inTauri } from "../lib/tauri";

// Integrated shell at the bottom of the editor column (id "terminal"). Opens in
// the active project's folder; toggle with Ctrl+`.
export function TerminalPanel() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const cwd = project?.path || null;
  const toggle = useStore((s) => s.toggle);
  const height = useStore((s) => s.terminalHeight);
  const setHeight = useStore((s) => s.setTerminalHeight);

  return (
    <div className="term-panel" style={{ height }}>
      <ResizeHandle
        axis="y"
        side="top"
        value={height}
        min={120}
        max={620}
        dir={-1}
        onChange={setHeight}
      />
      <div className="term-head">
        <Icon name="terminal" size={14} />
        <span>Terminal</span>
        <span style={{ flex: 1 }} />
        <button
          className="cl-close"
          title="Close terminal"
          onClick={() => toggle("showTerminal")}
        >
          <Icon name="close" size={15} />
        </button>
      </div>
      {inTauri ? (
        <div className="term-body">
          <XtermView id="terminal" program={null} cwd={cwd} />
        </div>
      ) : (
        <div className="cl-note">The terminal runs in the desktop app.</div>
      )}
    </div>
  );
}
