import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../state/store";
import {
  claudeCli,
  onClaudeOutput,
  onClaudeExit,
  inTauri,
} from "../lib/tauri";

// The right panel is the real Claude Code CLI running in a PTY, rendered by
// xterm.js — a UI overlay around the normal `claude`, no API key involved.
export function ClaudePanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const projectPath = project?.path || null;
  const toggle = useStore((s) => s.toggle);
  const claudeWidth = useStore((s) => s.claudeWidth);
  const setClaudeWidth = useStore((s) => s.setClaudeWidth);

  // Recreate the terminal when the active project (cwd) changes.
  useEffect(() => {
    if (!hostRef.current || !inTauri) return;
    const css = getComputedStyle(document.documentElement);

    const term = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: css.getPropertyValue("--editor-font").trim() || "monospace",
      theme: {
        background: "rgba(0,0,0,0)",
        foreground: css.getPropertyValue("--text").trim() || "#e6e6ee",
        cursor: css.getPropertyValue("--accent").trim() || "#7c8cff",
        selectionBackground:
          css.getPropertyValue("--selection").trim() || "#7c8cff33",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();

    let disposed = false;
    let unsubOut: (() => void) | undefined;
    let unsubExit: (() => void) | undefined;

    (async () => {
      unsubOut = await onClaudeOutput((chunk) => term.write(chunk));
      unsubExit = await onClaudeExit(() =>
        term.write("\r\n\x1b[2m[claude exited — toggle the panel to restart]\x1b[0m\r\n")
      );
      if (!disposed) await claudeCli.start(projectPath, term.cols, term.rows);
    })();

    const onData = term.onData((d) => claudeCli.write(d));

    const ro = new ResizeObserver(() => {
      fit.fit();
      claudeCli.resize(term.cols, term.rows);
    });
    ro.observe(hostRef.current);

    return () => {
      disposed = true;
      onData.dispose();
      ro.disconnect();
      unsubOut?.();
      unsubExit?.();
      claudeCli.kill();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  return (
    <aside className="claude" style={{ width: claudeWidth }}>
      <ResizeHandle
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
        <div className="cl-term" ref={hostRef} />
      ) : (
        <div className="cl-note">
          Claude Code runs in a real terminal — launch the desktop app with{" "}
          <kbd>npm run app</kbd> to use it.
        </div>
      )}
    </aside>
  );
}
