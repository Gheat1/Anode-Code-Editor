import { useEffect, useRef, useState } from "react";
import { claudeUsage, claudeLimits, ClaudeUsage } from "../lib/tauri";
import { formatTokens, shortModel } from "../lib/usageFormat";
import { parseLimits, LimitEntry } from "../lib/claudeLimits";

function LimitBar({ e }: { e: LimitEntry }) {
  const tone = e.percent >= 90 ? "danger" : e.percent >= 70 ? "warn" : "ok";
  return (
    <div className="cl-limit">
      <div className="cl-limit-top">
        <span className="cl-limit-label">{e.label}</span>
        <span className="cl-limit-pct">{e.percent}%</span>
      </div>
      <div className="cl-limit-track">
        <div className={`cl-limit-fill ${tone}`} style={{ width: `${e.percent}%` }} />
      </div>
      <div className="cl-limit-reset">resets {e.resets}</div>
    </div>
  );
}

// Footer for the Claude panel: the real 5-hour + weekly limit bars (from
// `/usage`) plus a token/cost meter. Limits are fetched on mount and every
// 15 min, but only when Claude has actually been used since the last scan.
export function ClaudeUsageBar({ projectPath }: { projectPath: string | null }) {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [limits, setLimits] = useState<LimitEntry[] | null>(null);
  const curSig = useRef(""); // latest usage signature (activity probe)
  const lastSig = useRef(""); // usage signature at the last limits scan

  // Token meter: poll the session log every 5s. Doubles as the activity signal.
  useEffect(() => {
    if (!projectPath) {
      setUsage(null);
      curSig.current = "";
      return;
    }
    let alive = true;
    const poll = () =>
      claudeUsage(projectPath)
        .then((u) => {
          if (!alive) return;
          setUsage(u);
          curSig.current = u
            ? `${u.messages}:${u.output_tokens}:${u.context_tokens}`
            : "";
        })
        .catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [projectPath]);

  // Real limits: scan on mount, then every 15 min — but skip when nothing has
  // changed since the last scan (the "don't re-run while idle" rule).
  useEffect(() => {
    let alive = true;
    const scan = () =>
      claudeLimits(projectPath || "")
        .then((text) => {
          if (!alive) return;
          const parsed = parseLimits(text);
          if (parsed.length) setLimits(parsed);
          lastSig.current = curSig.current;
        })
        .catch(() => {});
    const init = setTimeout(scan, 1500); // let the first usage poll set the signature
    const t = setInterval(() => {
      if (curSig.current !== lastSig.current) scan();
    }, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearTimeout(init);
      clearInterval(t);
    };
  }, [projectPath]);

  const hasTokens = !!(projectPath && usage && usage.messages > 0);
  const bars = limits?.filter((l) => l.key === "session" || l.key === "week");

  if (!bars?.length && !hasTokens)
    return (
      <div className="cl-usage cl-usage-empty">
        Usage appears here after the first message
      </div>
    );

  const cost =
    usage && usage.cost_usd > 0
      ? `$${usage.cost_usd.toFixed(usage.cost_usd < 0.01 ? 3 : 2)}`
      : null;

  return (
    <div className="cl-usage-wrap">
      {bars && bars.length > 0 && (
        <div className="cl-limits">
          {bars.map((e) => (
            <LimitBar e={e} key={e.key} />
          ))}
        </div>
      )}
      {hasTokens && (
        <div className="cl-usage">
          <span className="cl-usage-seg" title="Tokens in the latest turn's context window">
            <span className="cl-usage-label">ctx</span> {formatTokens(usage!.context_tokens)}
          </span>
          <span className="cl-usage-seg" title="Output tokens this session">
            <span className="cl-usage-label">out</span> {formatTokens(usage!.output_tokens)}
          </span>
          {cost && (
            <span className="cl-usage-seg" title="Estimated session cost">
              <span className="cl-usage-label">cost</span> {cost}
            </span>
          )}
          <span className="cl-usage-grow" />
          {usage!.model && <span className="cl-usage-model">{shortModel(usage!.model)}</span>}
        </div>
      )}
    </div>
  );
}
