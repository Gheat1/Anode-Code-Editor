import { useCallback, useEffect, useState } from "react";
import { claudeUsage, claudeLimits, ClaudeUsage } from "../lib/tauri";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { formatTokens, shortModel } from "../lib/usageFormat";
import { parseLimits, LimitEntry } from "../lib/claudeLimits";

// Detailed usage for Settings → Claude Code → Usage: the real subscription
// limit bars (5h + weekly, from `/usage`) plus the itemized token breakdown for
// the active project's latest session.
export function ClaudeUsageDetail() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const path = project?.path || null;
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [limits, setLimits] = useState<LimitEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const u = path ? claudeUsage(path) : Promise.resolve(null);
    Promise.all([
      u.catch(() => null),
      claudeLimits(path || "")
        .then(parseLimits)
        .catch(() => [] as LimitEntry[]),
    ])
      .then(([usg, lim]) => {
        setUsage(usg);
        setLimits(lim.length ? lim : null);
      })
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  const tone = (p: number) => (p >= 90 ? "danger" : p >= 70 ? "warn" : "ok");

  const rows: [string, string][] =
    usage && usage.messages > 0
      ? [
          ["Model", shortModel(usage.model) || "—"],
          ["Context (latest turn)", `${formatTokens(usage.context_tokens)} tokens`],
          ["Input (session)", formatTokens(usage.input_tokens)],
          ["Output (session)", formatTokens(usage.output_tokens)],
          ["Cache read", formatTokens(usage.cache_read_tokens)],
          ["Cache write", formatTokens(usage.cache_creation_tokens)],
          ["Messages", String(usage.messages)],
          [
            "Estimated cost",
            usage.cost_usd > 0
              ? `$${usage.cost_usd.toFixed(usage.cost_usd < 0.01 ? 4 : 2)}`
              : "—",
          ],
        ]
      : [];

  const refresh = (
    <button className="cl-usage-refresh" onClick={load}>
      <Icon name="sync" size={13} /> {loading ? "Checking…" : "Refresh"}
    </button>
  );

  return (
    <>
      {limits && (
        <div className="cl-limits cl-limits-detail">
          {limits.map((e) => (
            <div className="cl-limit" key={e.key}>
              <div className="cl-limit-top">
                <span className="cl-limit-label">{e.label}</span>
                <span className="cl-limit-pct">{e.percent}%</span>
              </div>
              <div className="cl-limit-track">
                <div
                  className={`cl-limit-fill ${tone(e.percent)}`}
                  style={{ width: `${e.percent}%` }}
                />
              </div>
              <div className="cl-limit-reset">resets {e.resets}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="cl-usage-detail">
          {rows.map(([k, v]) => (
            <div className="cl-usage-detail-row" key={k}>
              <span className="cl-usage-detail-k">{k}</span>
              <span className="cl-usage-detail-v">{v}</span>
            </div>
          ))}
        </div>
      )}

      {!limits && rows.length === 0 && (
        <div className="row">
          <label style={{ color: "var(--text-faint)" }}>
            {path
              ? `No usage recorded yet for ${project?.name}. Start a conversation in Claude Code first.`
              : "Limits load once Claude has been used; open a project folder for token details too."}
          </label>
        </div>
      )}

      {refresh}
    </>
  );
}
