import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { pty, onPtyOutput, onPtyExit, inTauri } from "../lib/tauri";

// Mounts an xterm.js terminal bound to a keyed PTY session. `program` null
// opens a shell; "claude" runs Claude Code. Recreated when id/program/cwd change.
export function XtermView({
  id,
  program,
  cwd,
}: {
  id: string;
  program: string | null;
  cwd: string | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

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
      unsubOut = await onPtyOutput((sid, chunk) => {
        if (sid === id) term.write(chunk);
      });
      unsubExit = await onPtyExit((sid) => {
        if (sid === id)
          term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
      });
      if (!disposed) await pty.start(id, program, cwd, term.cols, term.rows);
    })();

    const onData = term.onData((d) => pty.write(id, d));
    const ro = new ResizeObserver(() => {
      fit.fit();
      pty.resize(id, term.cols, term.rows);
    });
    ro.observe(hostRef.current);

    return () => {
      disposed = true;
      onData.dispose();
      ro.disconnect();
      unsubOut?.();
      unsubExit?.();
      pty.kill(id);
      term.dispose();
    };
  }, [id, program, cwd]);

  return <div className="xterm-host" ref={hostRef} />;
}
