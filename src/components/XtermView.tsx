import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { pty, onPtyOutput, onPtyExit, inTauri } from "../lib/tauri";

// Mounts an xterm.js terminal bound to a keyed PTY session. `program` null
// opens a shell; "claude" runs Claude Code. Recreated when id/program/cwd change.
export function XtermView({
  id,
  program,
  args = null,
  cwd,
  onStatus,
  onBuffer,
}: {
  id: string;
  program: string | null;
  args?: string[] | null;
  cwd: string | null;
  onStatus?: (status: "running" | "exited") => void;
  // Called (debounced) with the terminal's scraped buffer text, one entry per
  // line, whenever output changes — used to mirror the session into the chat UI.
  onBuffer?: (lines: string[]) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Read the latest args/onStatus at run time so they don't force a remount.
  const argsRef = useRef(args);
  argsRef.current = args;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onBufferRef = useRef(onBuffer);
  onBufferRef.current = onBuffer;

  useEffect(() => {
    if (!hostRef.current || !inTauri) return;
    const css = getComputedStyle(document.documentElement);

    const term = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontSize: parseFloat(css.getPropertyValue("--editor-font-size")) || 13,
      lineHeight: 1.15,
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
    // GPU-accelerated rendering so heavy TUI output (Claude redraws) doesn't
    // thrash the main thread. Falls back to the canvas renderer if WebGL is
    // unavailable or the context is lost.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      /* no WebGL — canvas fallback */
    }
    fit.fit();

    // Listeners are registered async; if we unmount before they resolve we must
    // still unsubscribe them — otherwise they leak and keep writing to a dead
    // terminal on every PTY event. `track` handles that race.
    let disposed = false;
    const unsubs: Array<() => void> = [];
    const track = (u: () => void) => {
      if (disposed) u();
      else unsubs.push(u);
    };

    // Scrape the parsed buffer (plain text, one string per line) for the chat
    // overlay. xterm already resolved every ANSI escape / cursor redraw, so we
    // just read the resulting cells. Debounced so a burst of output coalesces
    // into one parse. Hidden (warm) sessions still scrape — the buffer model
    // updates regardless of whether the renderer is on screen.
    let scrapeTimer: ReturnType<typeof setTimeout> | undefined;
    const scrape = () => {
      const cb = onBufferRef.current;
      if (!cb || disposed) return;
      const buf = term.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buf.length; i++) {
        const ln = buf.getLine(i);
        lines.push(ln ? ln.translateToString(true) : "");
      }
      cb(lines);
    };
    const scheduleScrape = () => {
      if (!onBufferRef.current) return;
      if (scrapeTimer) clearTimeout(scrapeTimer);
      scrapeTimer = setTimeout(scrape, 80);
    };

    (async () => {
      track(
        await onPtyOutput((sid, chunk) => {
          if (!disposed && sid === id) {
            term.write(chunk);
            scheduleScrape();
          }
        })
      );
      track(
        await onPtyExit((sid) => {
          if (!disposed && sid === id) {
            term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
            onStatusRef.current?.("exited");
          }
        })
      );
      if (!disposed) {
        try {
          await pty.start(id, program, argsRef.current, cwd, term.cols, term.rows);
          onStatusRef.current?.("running");
        } catch {
          /* backend unavailable — ignore */
        }
      }
    })();

    const onData = term.onData((d) => {
      if (!disposed) pty.write(id, d);
    });

    // Debounce resize so layout changes don't thrash fit()/resize.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (disposed) return;
        fit.fit();
        pty.resize(id, term.cols, term.rows);
      });
    });
    ro.observe(hostRef.current);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (scrapeTimer) clearTimeout(scrapeTimer);
      onData.dispose();
      ro.disconnect();
      unsubs.forEach((u) => u());
      pty.kill(id);
      term.dispose();
    };
  }, [id, program, cwd]);

  return <div className="xterm-host" ref={hostRef} />;
}
