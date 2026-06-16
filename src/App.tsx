import { useEffect, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { ClaudePanel } from "./components/ClaudePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SetupWizard } from "./components/SetupWizard";
import { useStore, syncAppearance } from "./state/store";
import { setBlur } from "./lib/tauri";
import { saveActiveFile, closeActiveTab } from "./lib/actions";

export default function App() {
  const settings = useStore((s) => s.settings);
  const showClaude = useStore((s) => s.showClaude);
  const showSidebar = useStore((s) => s.showSidebar);
  const showSettings = useStore((s) => s.showSettings);
  const welcomeDismissed = useStore((s) => s.welcomeDismissed);
  // Show the README once per launch until the user dismisses it for good.
  const [showWelcome, setShowWelcome] = useState(!welcomeDismissed);

  // Apply theme + global font on any settings change.
  useEffect(() => {
    syncAppearance(settings);
  }, [settings]);

  // Drive the native Windows acrylic from the toggle. Acrylic is Windows-only,
  // so elsewhere we force solid surfaces (no see-through panels).
  useEffect(() => {
    const isWindows = navigator.userAgent.includes("Windows");
    const blurOn = isWindows && settings.blurEnabled;
    document.body.classList.toggle("no-blur", !blurOn);
    if (isWindows) setBlur(settings.blurEnabled).catch(() => {});
  }, [settings.blurEnabled]);

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
        {showClaude && <ClaudePanel />}
      </div>
      {showSettings && <SettingsPanel />}
      {showWelcome && <SetupWizard onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
