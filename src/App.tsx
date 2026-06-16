import { useEffect, useState, lazy, Suspense } from "react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { useContextMenu } from "./components/ContextMenu";
import { useStore, syncAppearance } from "./state/store";
import { account } from "./lib/account";
import { saveActiveFile, closeActiveTab, editor } from "./lib/actions";

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
const AboutModal = lazy(() =>
  import("./components/AboutModal").then((m) => ({ default: m.AboutModal }))
);

export default function App() {
  const settings = useStore((s) => s.settings);
  const showClaude = useStore((s) => s.showClaude);
  const showSidebar = useStore((s) => s.showSidebar);
  const showSettings = useStore((s) => s.showSettings);
  const showAbout = useStore((s) => s.showAbout);
  const welcomeDismissed = useStore((s) => s.welcomeDismissed);
  const switching = useStore((s) => s.switching);
  const pendingProjectId = useStore((s) => s.pendingProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const finishSwitch = useStore((s) => s.finishSwitch);
  const toggle = useStore((s) => s.toggle);
  const newTerminal = useStore((s) => s.newTerminal);
  const openContextMenu = useContextMenu();
  const [showWelcome, setShowWelcome] = useState(!welcomeDismissed);

  // Once Claude has been opened this session, keep its panel mounted (just
  // hidden when closed) so the running session survives closing the tab. We
  // don't auto-mount on a cold launch where it was left closed.
  const [claudeMounted, setClaudeMounted] = useState(showClaude);
  useEffect(() => {
    if (showClaude) setClaudeMounted(true);
  }, [showClaude]);

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

  // Default right-click anywhere: editor clipboard ops + file/panel shortcuts.
  // Components with their own items (e.g. folder rows) handle the event first
  // and stopPropagation so this one doesn't also fire.
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const hasSel = editor.hasSelection();
    openContextMenu(e.clientX, e.clientY, [
      { label: "Cut", run: editor.cut, disabled: !hasSel },
      { label: "Copy", run: editor.copy, disabled: !hasSel },
      { label: "Paste", run: editor.paste },
      { label: "Save", separator: true, run: saveActiveFile },
      { label: "Close Tab", run: closeActiveTab },
      { label: "Find", run: editor.find },
      { label: "New Terminal", separator: true, run: newTerminal },
      { label: "Open Claude Code", run: () => useStore.setState({ showClaude: true }) },
    ]);
  }

  return (
    <div className="app" onContextMenu={handleContextMenu}>
      <TitleBar />
      <div className="workspace">
        <ActivityBar />
        {showSidebar && <Sidebar />}
        <EditorArea />
        {claudeMounted && (
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
      {showAbout && (
        <Suspense fallback={null}>
          <AboutModal onClose={() => toggle("showAbout")} />
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
