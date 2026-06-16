import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { projectStats, ProjectStats } from "../lib/tauri";

// Compact number formatting: 1234 -> "1,234", 1_200_000 -> "1.2M".
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  return n.toLocaleString();
}

function fmtBytes(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
  if (n >= 1 << 10) return `${(n / (1 << 10)).toFixed(0)} KB`;
  return `${n} B`;
}

// Project Info dialog: total files / lines of code / size for the open folder,
// plus a per-language breakdown. Opened from the brand menu (View → Project
// Info). Stats come from the Rust `project_stats` walk.
export function ProjectInfoModal({ onClose }: { onClose: () => void }) {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = project?.path ?? "";

  useEffect(() => {
    let alive = true;
    if (!path) {
      setError("Open a folder for this project to see its stats.");
      return;
    }
    setStats(null);
    setError(null);
    projectStats(path)
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [path]);

  // Largest language line count, to scale the breakdown bars.
  const maxLines = stats?.languages.reduce((m, l) => Math.max(m, l.lines), 0) ?? 0;
  const langs = (stats?.languages ?? []).filter((l) => l.lines > 0).slice(0, 8);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="proj-info" onClick={(e) => e.stopPropagation()}>
        <div className="proj-info-head">
          <h2>{project?.name ?? "Project"}</h2>
          {path && <div className="proj-info-path">{path}</div>}
        </div>

        {error && <div className="proj-info-empty">{error}</div>}

        {!error && !stats && (
          <div className="proj-info-empty">
            <div className="repo-spinner" />
            <span>Scanning project…</span>
          </div>
        )}

        {stats && (
          <>
            <div className="proj-stat-grid">
              <div className="proj-stat">
                <div className="proj-stat-num">{fmtNum(stats.lines)}</div>
                <div className="proj-stat-label">Lines of code</div>
              </div>
              <div className="proj-stat">
                <div className="proj-stat-num">{fmtNum(stats.files)}</div>
                <div className="proj-stat-label">Files</div>
              </div>
              <div className="proj-stat">
                <div className="proj-stat-num">{fmtNum(stats.dirs)}</div>
                <div className="proj-stat-label">Folders</div>
              </div>
              <div className="proj-stat">
                <div className="proj-stat-num">{fmtBytes(stats.bytes)}</div>
                <div className="proj-stat-label">On disk</div>
              </div>
            </div>

            {langs.length > 0 && (
              <div className="proj-langs">
                <div className="proj-langs-title">Languages</div>
                {langs.map((l) => (
                  <div key={l.name} className="proj-lang-row">
                    <span className="proj-lang-name">{l.name}</span>
                    <div className="proj-lang-track">
                      <div
                        className="proj-lang-bar"
                        style={{
                          width: `${maxLines ? (l.lines / maxLines) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="proj-lang-count">
                      {fmtNum(l.lines)} <span className="proj-lang-files">· {l.files} {l.files === 1 ? "file" : "files"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <button className="done" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
