import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { WarmTerminals } from "./WarmTerminals";
import { useStore } from "../state/store";
import { inTauri } from "../lib/tauri";

// Integrated shell at the bottom of the editor column. One warm shell per
// recent project (id "terminal:<projectId>"); opens in the active project's
// folder. Toggle with Ctrl+`. "New Terminal" (header button or the right-click
// menu) bumps `terminalRestart` in the store, which respawns the active shell.
export function TerminalPanel() {
  const toggle = useStore((s) => s.toggle);
  const height = useStore((s) => s.terminalHeight);
  const setHeight = useStore((s) => s.setTerminalHeight);
  const restartKey = useStore((s) => s.terminalRestart);
  const newTerminal = useStore((s) => s.newTerminal);

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
        <button className="cl-close" title="New shell" onClick={newTerminal}>
          <Icon name="plus" size={15} />
        </button>
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
          <WarmTerminals idPrefix="terminal" program={null} restartKey={restartKey} />
        </div>
      ) : (
        <div className="cl-note">The terminal runs in the desktop app.</div>
      )}
    </div>
  );
}
