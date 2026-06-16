import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { XtermView } from "./XtermView";
import { useStore, Settings } from "../state/store";
import { inTauri } from "../lib/tauri";

// Translate the Claude settings into CLI flags.
export function claudeArgs(s: Settings): string[] {
  const a: string[] = [];
  if (s.claudeSkipPermissions) a.push("--dangerously-skip-permissions");
  else if (s.claudePermissionMode !== "default")
    a.push("--permission-mode", s.claudePermissionMode);
  if (s.claudeModel.trim()) a.push("--model", s.claudeModel.trim());
  if (s.claudeContinue) a.push("--continue");
  if (s.claudeVerbose) a.push("--verbose");
  const extra = s.claudeExtraFlags.trim();
  if (extra) a.push(...extra.split(/\s+/));
  return a;
}

export function ClaudePanel() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const projectPath = project?.path || null;
  const settings = useStore((s) => s.settings);
  const toggle = useStore((s) => s.toggle);
  const claudeWidth = useStore((s) => s.claudeWidth);
  const setClaudeWidth = useStore((s) => s.setClaudeWidth);

  const [sessionKey, setSessionKey] = useState(0);
  const [status, setStatus] = useState<"running" | "exited">("running");

  function restart() {
    setStatus("running");
    setSessionKey((k) => k + 1);
  }

  // Auto-restart when a structured flag flips (toggles/dropdown). Free-text
  // fields (model, extra flags) apply on the next manual restart instead, so we
  // don't relaunch on every keystroke.
  const sig = `${settings.claudeSkipPermissions}|${settings.claudePermissionMode}|${settings.claudeContinue}|${settings.claudeVerbose}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    restart();
  }, [sig]);

  const dangerous = settings.claudeSkipPermissions;

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
        <span className="cl-badge">
          <Icon name="sparkles" size={15} />
        </span>
        <div className="cl-title">
          <span className="cl-name">Claude Code</span>
          {project?.name && <span className="cl-proj">{project.name}</span>}
        </div>
        <span className="cl-spacer" />
        {dangerous && (
          <span className="cl-danger" title="--dangerously-skip-permissions is on">
            <Icon name="warning" size={12} /> bypass
          </span>
        )}
        <span className={`cl-status ${status}`}>
          <span className="cl-dot" />
          {status === "running" ? "ready" : "stopped"}
        </span>
        <button className="cl-tool" title="New session (applies Claude settings)" onClick={restart}>
          <Icon name="sync" size={15} />
        </button>
        <button className="cl-tool" title="Close panel" onClick={() => toggle("showClaude")}>
          <Icon name="close" size={15} />
        </button>
      </div>

      {inTauri ? (
        <div className="cl-term">
          <XtermView
            key={sessionKey}
            id="claude"
            program="claude"
            args={claudeArgs(settings)}
            cwd={projectPath}
            onStatus={setStatus}
          />
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
