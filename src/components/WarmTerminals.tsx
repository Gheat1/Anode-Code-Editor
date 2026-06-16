import { useEffect, useRef, useState } from "react";
import { XtermView } from "./XtermView";
import { useStore } from "../state/store";

// A stack of keep-warm PTY views, one per recently-active project. Only the
// active project's view is visible; the rest stay mounted (and their PTY
// sessions alive) so switching back is instant instead of rebooting Claude /
// the shell. Projects that fall out of the warm LRU unmount, which kills their
// session (XtermView cleanup) to cap memory.
//
// We only ever render a view for a project that is — or has been — the active
// one, so a hidden view is never cold-spawned at 0×0; it always mounted while
// visible and sized correctly.
export function WarmTerminals({
  idPrefix,
  program,
  args = null,
  restartKey = 0,
  onActiveStatus,
}: {
  idPrefix: string; // PTY id becomes `${idPrefix}:${projectId}`
  program: string | null;
  args?: string[] | null;
  restartKey?: number; // bump to restart the active project's session
  onActiveStatus?: (status: "running" | "exited") => void;
}) {
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const warmIds = useStore((s) => s.warmProjectIds);

  // Projects this pool has actually shown. The active one is always included.
  const [shown, setShown] = useState<string[]>(() =>
    activeProjectId ? [activeProjectId] : []
  );
  useEffect(() => {
    if (activeProjectId && !shown.includes(activeProjectId))
      setShown((s) => [...s, activeProjectId]);
  }, [activeProjectId, shown]);

  // Surface the active project's session status up to the panel chrome (the
  // "ready / stopped" pill), even when switching to an already-warm session.
  const [statuses, setStatuses] = useState<
    Record<string, "running" | "exited">
  >({});
  useEffect(() => {
    const st = activeProjectId ? statuses[activeProjectId] : undefined;
    if (st) onActiveStatus?.(st);
  }, [activeProjectId, statuses, onActiveStatus]);

  // A restart (restartKey bump) must remount only the active project's view,
  // not disturb the warm ones. Track a per-project restart counter keyed into
  // the view's React key, so switching projects never changes a key (and thus
  // never tears down a warm session).
  const [restarts, setRestarts] = useState<Record<string, number>>({});
  const lastRestart = useRef(restartKey);
  useEffect(() => {
    if (restartKey === lastRestart.current) return;
    lastRestart.current = restartKey;
    if (activeProjectId)
      setRestarts((m) => ({
        ...m,
        [activeProjectId]: (m[activeProjectId] ?? 0) + 1,
      }));
  }, [restartKey, activeProjectId]);

  const liveIds = warmIds.filter(
    (id) => id === activeProjectId || shown.includes(id)
  );

  return (
    <>
      {liveIds.map((id) => {
        const project = projects.find((p) => p.id === id);
        if (!project) return null;
        const active = id === activeProjectId;
        return (
          <div
            key={id}
            className="warm-term"
            style={{ display: active ? "flex" : "none" }}
          >
            <XtermView
              // Stable per project; bumps only when this project is explicitly
              // restarted, so switching never remounts (and kills) a session.
              key={`r${restarts[id] ?? 0}`}
              id={`${idPrefix}:${id}`}
              program={program}
              args={args}
              cwd={project.path || null}
              onStatus={(st) =>
                setStatuses((m) => (m[id] === st ? m : { ...m, [id]: st }))
              }
            />
          </div>
        );
      })}
    </>
  );
}
