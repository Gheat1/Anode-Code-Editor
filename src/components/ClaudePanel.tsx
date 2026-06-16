import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ResizeHandle } from "./ResizeHandle";
import { WarmTerminals } from "./WarmTerminals";
import { ClaudeUsageBar } from "./ClaudeUsageBar";
import { useStore, Settings } from "../state/store";
import { inTauri } from "../lib/tauri";
import { notify } from "../lib/notify";

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
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const toggle = useStore((s) => s.toggle);
  const claudeWidth = useStore((s) => s.claudeWidth);
  const setClaudeWidth = useStore((s) => s.setClaudeWidth);
  const showClaude = useStore((s) => s.showClaude);
  const setClaudeStatus = useStore((s) => s.setClaudeStatus);

  // The genuine `claude` CLI always runs in the terminal below (so every slash
  // command works natively); `showUsage` just toggles the token/cost meter.
  const showUsage = settings.claudeChatUi;

  const [sessionKey, setSessionKey] = useState(0);
  const [status, setStatus] = useState<"running" | "exited">("running");
  const [buf, setBuf] = useState<string[]>([]);

  // Claude is mid-turn while its spinner's "esc to interrupt" affordance is on
  // screen — a narrow, version-stable signal (no full-transcript parsing).
  const busy = useMemo(() => buf.some((l) => /esc to interrupt/i.test(l)), [buf]);

  // Publish status to the store so the activity bar can show a running/busy dot
  // even when the panel is closed (the session keeps running — see App).
  useEffect(() => {
    setClaudeStatus(status === "running", busy);
  }, [status, busy, setClaudeStatus]);

  // Desktop notifications. Fire when Claude prints a permission prompt, and when
  // it finishes a turn while the panel is closed or the window is backgrounded
  // (no point pinging you when you're already watching it).
  const notifEnabled = settings.notifications;
  const notifiedPerm = useRef(false);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (!notifEnabled) return;
    const needsPerm = buf.some((l) =>
      /(do you want to (proceed|allow|make)|❯\s*1\.\s*yes)/i.test(l)
    );
    if (needsPerm && !notifiedPerm.current) {
      notifiedPerm.current = true;
      notify("Claude needs permission", project?.name ? `In ${project.name}` : undefined);
    } else if (!needsPerm) {
      notifiedPerm.current = false;
    }
  }, [buf, notifEnabled, project?.name]);
  useEffect(() => {
    if (notifEnabled && wasBusy.current && !busy && (!showClaude || document.hidden)) {
      notify("Claude is ready", project?.name ? `Finished in ${project.name}` : "Finished responding");
    }
    wasBusy.current = busy;
  }, [busy, notifEnabled, showClaude, project?.name]);

  function restart() {
    setStatus("running");
    setBuf([]);
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

  // Kept mounted (just hidden) when closed, so the Claude session keeps running
  // in the background and switching workspaces / reopening is instant.
  return (
    <aside
      className="claude"
      style={{ width: claudeWidth, display: showClaude ? undefined : "none" }}
    >
      <ResizeHandle
        axis="x"
        side="left"
        value={claudeWidth}
        min={240}
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
        <span className={`cl-status ${status} ${busy ? "busy" : ""}`}>
          <span className="cl-dot" />
          {status === "running" ? (busy ? "working" : "ready") : "stopped"}
        </span>
        <button
          className={`cl-tool ${showUsage ? "on" : ""}`}
          title={showUsage ? "Hide usage meter" : "Show usage meter"}
          onClick={() => setSetting("claudeChatUi", !showUsage)}
        >
          <Icon name="sliders" size={15} />
        </button>
        <button
          className="cl-tool"
          title="New session (applies Claude settings)"
          onClick={restart}
        >
          <Icon name="sync" size={15} />
        </button>
        <button
          className="cl-tool"
          title="Close panel"
          onClick={() => toggle("showClaude")}
        >
          <Icon name="close" size={15} />
        </button>
      </div>

      {inTauri ? (
        <>
          <div className="cl-body">
            <div className="cl-term">
              <WarmTerminals
                idPrefix="claude"
                program="claude"
                args={claudeArgs(settings)}
                restartKey={sessionKey}
                onActiveStatus={setStatus}
                onActiveBuffer={setBuf}
              />
            </div>
          </div>
          {showUsage && <ClaudeUsageBar projectPath={project?.path || null} />}
        </>
      ) : (
        <div className="cl-note">
          Claude Code runs in a real terminal — launch the desktop app with{" "}
          <kbd>npm run app</kbd> to use it.
        </div>
      )}
    </aside>
  );
}
