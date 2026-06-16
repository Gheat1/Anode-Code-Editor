import { openUrl } from "../lib/tauri";

// Keep in sync with package.json / tauri.conf.json / Cargo.toml.
const APP_VERSION = "1.4.0";

// About dialog reached from the brand menu → Help → About Anode.
export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="about" onClick={(e) => e.stopPropagation()}>
        <div className="about-mark">◆</div>
        <h2>Anode</h2>
        <div className="about-tagline">A Simple, Clean, Efficient Editor.</div>
        <div className="about-version">Version {APP_VERSION}</div>

        <p className="about-desc">
          A Claude-native desktop code editor built from scratch — the real Claude
          Code CLI in a real terminal, integrated source control, and a deep theme
          system. Built with Tauri, React, and CodeMirror.
        </p>

        <div className="about-meta">
          <span>© 2026 Gheat</span>
          <span>·</span>
          <button className="about-link" onClick={() => openUrl("https://gheat.net/anode")}>
            gheat.net/anode
          </button>
        </div>

        <button className="done" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
