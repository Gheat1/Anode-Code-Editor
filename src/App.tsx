import { useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { ClaudePanel } from "./components/ClaudePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { useStore, syncAppearance } from "./state/store";
import { setBlur } from "./lib/tauri";
import { WELCOME_FILES } from "./data/welcome";

export default function App() {
  const settings = useStore((s) => s.settings);
  const showClaude = useStore((s) => s.showClaude);
  const showSettings = useStore((s) => s.showSettings);
  const openFiles = useStore((s) => s.openFiles);
  const openFile = useStore((s) => s.openFile);

  // Apply theme + global font on any settings change.
  useEffect(() => {
    syncAppearance(settings);
  }, [settings]);

  // Drive the native Windows blur from the toggle.
  useEffect(() => {
    document.body.classList.toggle("no-blur", !settings.blurEnabled);
    setBlur(settings.blurEnabled).catch(() => {});
  }, [settings.blurEnabled]);

  // Open the welcome file once on first run so the editor isn't empty.
  useEffect(() => {
    if (openFiles.length === 0) {
      openFile(WELCOME_FILES["welcome.md"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="workspace">
        <ActivityBar />
        <Sidebar />
        <EditorArea />
        {showClaude && <ClaudePanel />}
      </div>
      {showSettings && <SettingsPanel />}
    </div>
  );
}
