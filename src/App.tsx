import { useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { ClaudePanel } from "./components/ClaudePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { useStore, syncAppearance } from "./state/store";
import { setBlur } from "./lib/tauri";
import { saveActiveFile, closeActiveTab } from "./lib/actions";
import { WELCOME_FILES } from "./data/welcome";

export default function App() {
  const settings = useStore((s) => s.settings);
  const showClaude = useStore((s) => s.showClaude);
  const showSidebar = useStore((s) => s.showSidebar);
  const showSettings = useStore((s) => s.showSettings);
  const openFiles = useStore((s) => s.openFiles);
  const openFile = useStore((s) => s.openFile);
  const welcomeDismissed = useStore((s) => s.welcomeDismissed);

  // Apply theme + global font on any settings change.
  useEffect(() => {
    syncAppearance(settings);
  }, [settings]);

  // Drive the native Windows blur from the toggle.
  useEffect(() => {
    document.body.classList.toggle("no-blur", !settings.blurEnabled);
    setBlur(settings.blurEnabled).catch(() => {});
  }, [settings.blurEnabled]);

  // Open the welcome file on first run (until the user dismisses it).
  useEffect(() => {
    if (!welcomeDismissed && openFiles.length === 0) {
      openFile(WELCOME_FILES["welcome.md"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {showClaude && <ClaudePanel />}
      </div>
      {showSettings && <SettingsPanel />}
    </div>
  );
}
