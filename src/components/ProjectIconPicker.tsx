import { Project, useStore } from "../state/store";
import { pickImage, fs, inTauri } from "../lib/tauri";

const EMOJIS = [
  "📁", "📦", "🚀", "🛠️", "⚙️", "🔧", "💻", "🖥️", "🌐", "🔥",
  "⭐", "✨", "💎", "🎯", "🧠", "🤖", "📝", "📚", "🎨", "🧩",
  "🔬", "🧪", "🪐", "🌙", "☁️", "⚡", "🍀", "🌸", "🦊", "🐙",
  "🐳", "🦄", "👾", "🎮", "🎵", "📷", "🔒", "🗂️", "🏷️", "💡",
];

const COLORS = ["#7c8cff", "#6bdc9b", "#ffce6b", "#ff6b9d", "#88c0d0", "#a882ff", "#e5a36b"];

// Popover for customizing a project's icon. Emojis now; image upload (png/svg)
// works today; a curated icon pack can slot into the same grid later.
export function ProjectIconPicker({
  project,
  x,
  y,
  onClose,
}: {
  project: Project;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const updateProject = useStore((s) => s.updateProject);

  function setIcon(icon: string | undefined) {
    updateProject(project.id, { icon });
  }

  async function upload() {
    const path = await pickImage();
    if (!path) return;
    try {
      const url = await fs.readImageDataUrl(path);
      setIcon(url);
      onClose();
    } catch {
      /* unreadable image — ignore */
    }
  }

  return (
    <>
      <div className="picker-scrim" onClick={onClose} />
      <div
        className="icon-picker"
        style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 320) }}
      >
        <div className="ip-head">Project icon</div>

        <div className="ip-emojis">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`ip-emoji ${project.icon === e ? "active" : ""}`}
              onClick={() => {
                setIcon(e);
                onClose();
              }}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="ip-label">Tint</div>
        <div className="ip-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`ip-color ${project.color === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => updateProject(project.id, { color: c })}
            />
          ))}
        </div>

        <div className="ip-actions">
          <button className="ip-btn" onClick={upload} disabled={!inTauri}>
            Upload PNG / SVG…
          </button>
          <button className="ip-btn ghost" onClick={() => setIcon(undefined)}>
            Reset to folder
          </button>
        </div>
        <div className="ip-soon">More icon packs coming soon</div>
      </div>
    </>
  );
}
