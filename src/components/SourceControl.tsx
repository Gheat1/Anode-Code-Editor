import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useStore } from "../state/store";
import {
  git,
  github,
  openUrl,
  fs,
  inTauri,
  GitInfo,
  DeviceStart,
  Commit,
} from "../lib/tauri";
import { languageName } from "../editor/setup";

// Maps a porcelain status code to a single-letter badge + color role.
function statusBadge(code: string): { letter: string; cls: string; title: string } {
  const c = code.replace(/\s/g, "");
  if (c === "??") return { letter: "U", cls: "scm-u", title: "Untracked" };
  if (c.startsWith("A")) return { letter: "A", cls: "scm-a", title: "Added" };
  if (c.startsWith("D")) return { letter: "D", cls: "scm-d", title: "Deleted" };
  if (c.startsWith("R")) return { letter: "R", cls: "scm-m", title: "Renamed" };
  if (c.includes("U")) return { letter: "!", cls: "scm-d", title: "Conflict" };
  return { letter: "M", cls: "scm-m", title: "Modified" };
}

export function SourceControl() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const openFile = useStore((s) => s.openFile);
  const path = project?.path || "";

  const [gitInstalled, setGitInstalled] = useState<boolean | null>(null);
  const [info, setInfo] = useState<GitInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GitHub auth state.
  const [ghUser, setGhUser] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceStart | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!inTauri || !path) {
      setInfo(null);
      setCommits([]);
      return;
    }
    try {
      const i = await git.info(path);
      setInfo(i);
      if (i.is_repo && i.has_commits) {
        try {
          setCommits(await git.log(path, 25));
        } catch {
          setCommits([]);
        }
      } else {
        setCommits([]);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [path]);

  useEffect(() => {
    if (!inTauri) return;
    git.available().then(setGitInstalled).catch(() => setGitInstalled(false));
    github.user().then(setGhUser).catch(() => setGhUser(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll the GitHub device-flow endpoint until authorized.
  useEffect(() => {
    if (!device) return;
    let active = true;
    let timer = 0;
    const poll = async () => {
      if (!active) return;
      try {
        const login = await github.devicePoll(device.device_code);
        if (login) {
          setGhUser(login);
          setDevice(null);
          return;
        }
      } catch (e) {
        setAuthError(String(e));
        setDevice(null);
        return;
      }
      timer = window.setTimeout(poll, (device.interval || 5) * 1000);
    };
    timer = window.setTimeout(poll, (device.interval || 5) * 1000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [device]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!message.trim() || !path) return;
    await run("commit", () => git.commitAll(path, message.trim()));
    setMessage("");
  }

  async function sync() {
    if (!path) return;
    await run("sync", async () => {
      if ((info?.behind ?? 0) > 0) await git.pull(path);
      await git.push(path);
    });
  }

  async function openChangedFile(p: string) {
    if (!path) return;
    const full = `${path}\\${p}`.replace(/\\+/g, "\\");
    try {
      const content = await fs.readFile(full);
      const name = p.split(/[\\/]/).pop() || p;
      openFile({
        id: full,
        name,
        path: full,
        language: languageName(name),
        content,
        dirty: false,
      });
    } catch {
      /* deleted / unreadable */
    }
  }

  async function startLogin() {
    setAuthError(null);
    try {
      const d = await github.deviceStart();
      setDevice(d);
      openUrl(d.verification_uri);
    } catch (e) {
      setAuthError(String(e));
    }
  }

  // ---- Render branches -----------------------------------------------------
  if (!inTauri) {
    return <div className="scm-empty">Source control runs in the desktop app.</div>;
  }
  if (gitInstalled === false) {
    return (
      <div className="scm-empty">
        <Icon name="git" size={28} />
        <p>Git isn't installed.</p>
        <button className="scm-btn" onClick={() => openUrl("https://git-scm.com/download/win")}>
          Download Git for Windows
        </button>
      </div>
    );
  }
  if (!path) {
    return (
      <div className="scm-empty">
        <Icon name="folder" size={28} />
        <p>Open a folder to use source control.</p>
      </div>
    );
  }

  const isRepo = info?.is_repo;
  const files = info?.files ?? [];

  return (
    <div className="scm">
      <div className="scm-head">
        <span>Source Control</span>
        {isRepo && (
          <button className="scm-icon" title="Refresh" onClick={refresh}>
            <Icon name="sync" size={14} />
          </button>
        )}
      </div>

      {!isRepo ? (
        <div className="scm-init">
          <p>This folder isn't a git repository yet.</p>
          <button
            className="scm-btn primary"
            disabled={busy === "init"}
            onClick={() => run("init", () => git.init(path))}
          >
            <Icon name="git" size={15} /> Initialize Repository
          </button>
        </div>
      ) : (
        <>
          <div className="scm-commit">
            <textarea
              rows={2}
              value={message}
              placeholder={`Message (commit on ${info?.branch || "main"})`}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") commit();
              }}
            />
            <button
              className="scm-btn primary full"
              disabled={!message.trim() || files.length === 0 || busy === "commit"}
              onClick={commit}
            >
              <Icon name="check" size={15} />
              {busy === "commit" ? "Committing…" : `Commit${files.length ? ` (${files.length})` : ""}`}
            </button>
            <button
              className="scm-btn full"
              disabled={busy === "sync"}
              onClick={sync}
              title={info?.remote || "No remote configured"}
            >
              <Icon name="sync" size={15} />
              {busy === "sync"
                ? "Syncing…"
                : `Sync${info && (info.ahead || info.behind) ? ` ↓${info.behind} ↑${info.ahead}` : ""}`}
            </button>
          </div>

          <div className="scm-section-label">
            Changes <span className="scm-count">{files.length}</span>
          </div>
          <div className="scm-files">
            {files.length === 0 && <div className="scm-clean">No changes</div>}
            {files.map((f) => {
              const b = statusBadge(f.status);
              const name = f.path.split(/[\\/]/).pop() || f.path;
              return (
                <div
                  key={f.path}
                  className="scm-file"
                  title={f.path}
                  onClick={() => openChangedFile(f.path)}
                >
                  <Icon name="file" size={15} />
                  <span className="scm-name">{name}</span>
                  <span className={`scm-badge ${b.cls}`} title={b.title}>
                    {b.letter}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="scm-section-label">
            Commits <span className="scm-count">{commits.length}</span>
          </div>
          <div className="scm-commits">
            {commits.length === 0 && <div className="scm-clean">No commits yet</div>}
            {commits.map((c) => (
              <div
                key={c.hash}
                className="scm-commit-row"
                title={`${c.short} · ${c.author} · ${c.date}`}
              >
                <Icon name="commit" size={14} />
                <span className="scm-commit-msg">{c.subject}</span>
                <span className="scm-commit-meta">{c.date}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <div className="scm-error">{error}</div>}

      {/* ---- GitHub account ---- */}
      <div className="scm-account">
        {ghUser ? (
          <div className="scm-acct-row">
            <Icon name="github" size={16} />
            <span>{ghUser}</span>
            <span style={{ flex: 1 }} />
            <button
              className="scm-icon"
              title="Sign out"
              onClick={() => github.logout().then(() => setGhUser(null))}
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        ) : device ? (
          <div className="scm-device">
            <p>Enter this code on GitHub:</p>
            <div className="scm-code">{device.user_code}</div>
            <button className="scm-btn full" onClick={() => openUrl(device.verification_uri)}>
              Open GitHub
            </button>
            <button className="scm-link" onClick={() => setDevice(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="scm-btn full" onClick={startLogin}>
            <Icon name="github" size={16} /> Sign in with GitHub
          </button>
        )}
        {authError && <div className="scm-error">{authError}</div>}
      </div>
    </div>
  );
}
