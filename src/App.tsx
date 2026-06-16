import { useEffect, useState, lazy, Suspense } from "react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { useStore, syncAppearance } from "./state/store";
import { account } from "./lib/account";
import { saveActiveFile, closeActiveTab } from "./lib/actions";

// Heavy panels are code-split so the initial bundle (and webview parse) stays
// small; their chunks (xterm, etc.) load only when first shown.
const ClaudePanel = lazy(() =>
  import("./components/ClaudePanel").then((m) => ({ default: m.ClaudePanel }))
);
const SettingsPanel = lazy(() =>
  import("./components/SettingsPanel").then((m) => ({ default: m.SettingsPanel }))
);
const SetupWizard = lazy(() =>
  import("./components/SetupWizard").then((m) => ({ default: m.SetupWizard }))
);

export default function App() {
  const settings = useStore((s) => s.settings);
  const showClaude = useStore((s) => s.showClaude);
  const showSidebar = useStore((s) => s.showSidebar);
  const showSettings = useStore((s) => s.showSettings);
  const welcomeDismissed = useStore((s) => s.welcomeDismissed);
  const switching = useStore((s) => s.switching);
  const pendingProjectId = useStore((s) => s.pendingProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const finishSwitch = useStore((s) => s.finishSwitch);
  const [showWelcome, setShowWelcome] = useState(!welcomeDismissed);

  // Apply theme + global font on any settings change.
  useEffect(() => {
    syncAppearance(settings);
  }, [settings]);

  // Masked project switch: the overlay is already painted (switching=true), so
  // defer the swap to the next frame, then reveal as soon as it has rendered.
  // Warm projects keep their Claude/terminal sessions alive (see
  // WarmTerminals), so the swap is just a re-render — no PTY reboot — and the
  // overlay only needs to cover that, not a 15s session boot.
  useEffect(() => {
    if (!pendingProjectId) return;
    const id = pendingProjectId;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setActiveProject(id);
        requestAnimationFrame(() =>
          requestAnimationFrame(finishSwitch)
        );
      })
    );
    return () => cancelAnimationFrame(raf);
  }, [pendingProjectId, setActiveProject, finishSwitch]);

  // Validate the saved Anode-account session once on launch and publish the
  // signed-in email to the store (the activity bar + Settings read it).
  useEffect(() => {
    const setAccountEmail = useStore.getState().setAccountEmail;
    if (account.isSignedIn()) {
      account
        .me()
        .then(setAccountEmail)
        .catch(() => {
          account.logout();
          setAccountEmail(null);
        });
    } else {
      setAccountEmail(null);
    }
  }, []);

  // Global keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const { toggle } = useStore.getState();
      switch (k) {
        case "s":
          e.preventDefault();
          saveActiveFile();
          break;
        case "w":
          e.preventDefault();
          closeActiveTab();
          break;
        case "b":
          e.preventDefault();
          toggle("showSidebar");
          break;
        case "`":
          e.preventDefault();
          toggle("showTerminal");
          break;
        case "\\":
          e.preventDefault();
          toggle("splitView");
          break;
        case "j":
          e.preventDefault();
          toggle("showClaude");
          break;
        case ",":
          e.preventDefault();
          toggle("showSettings");
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="workspace">
        <ActivityBar />
        {showSidebar && <Sidebar />}
        <EditorArea />
        {showClaude && (
          <Suspense fallback={null}>
            <ClaudePanel />
          </Suspense>
        )}
      </div>

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsPanel />
        </Suspense>
      )}
      {showWelcome && (
        <Suspense fallback={null}>
          <SetupWizard onClose={() => setShowWelcome(false)} />
        </Suspense>
      )}

      {switching && (
        <div className="repo-loading">
          <div className="repo-spinner" />
          <div className="repo-loading-text">Switching project…</div>
        </div>
      )}
    </div>
  );
}
