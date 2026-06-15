import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { XtermView } from "./XtermView";
import { useStore } from "../state/store";
import { inTauri } from "../lib/tauri";

// The right panel is the real Claude Code CLI in a PTY (id "claude"), rendered
// by xterm.js — a UI overlay around `claude`, no API key.
export function ClaudePanel() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const projectPath = project?.path || null;
  const toggle = useStore((s) => s.toggle);
  const claudeWidth = useStore((s) => s.claudeWidth);
  const setClaudeWidth = useStore((s) => s.setClaudeWidth);

  return (
    <aside className="claude" style={{ width: claudeWidth }}>
      <ResizeHandle
        axis="x"
        side="left"
        value={claudeWidth}
        min={300}
        max={760}
        dir={-1}
        onChange={setClaudeWidth}
      />
      <div className="cl-head">
        <Icon name="sparkles" size={16} />
        <span className="mark">Claude Code</span>
        {project?.name && (
          <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>
            · {project.name}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="cl-close"
          title="Close panel"
          onClick={() => toggle("showClaude")}
        >
          <Icon name="close" size={15} />
        </button>
      </div>

      {inTauri ? (
        <div className="cl-term">
          <XtermView id="claude" program="claude" cwd={projectPath} />
        </div>
      ) : (
        <div className="cl-note">
          Claude Code runs in a real terminal — launch the desktop app with{" "}
          <kbd>npm run app</kbd> to use it.
        </div>
      )}
    </aside>
  );
}
