import { Icon } from "./Icon";
import { useStore } from "../state/store";
import { pickFolder } from "../lib/tauri";

const PROJECT_COLORS = ["#7c8cff", "#6bdc9b", "#ffce6b", "#ff6b9d", "#88c0d0"];

// Left rail: quick project/repo switcher (top) and tool toggles (bottom).
// Switching projects is just state — the app never reloads.
export function ActivityBar() {
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const addProject = useStore((s) => s.addProject);
  const showPreview = useStore((s) => s.showPreview);
  const showClaude = useStore((s) => s.showClaude);
  const toggle = useStore((s) => s.toggle);
  const sidebarView = useStore((s) => s.sidebarView);
  const setSidebarView = useStore((s) => s.setSidebarView);

  async function addRepo() {
    const dir = await pickFolder();
    if (!dir) return;
    const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
    addProject({
      id: dir,
      name,
      path: dir,
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
    });
  }

  return (
    <nav className="activitybar">
      {projects.map((p) => (
        <button
          key={p.id}
          className={`project-icon ${p.id === activeProjectId ? "active" : ""}`}
          title={p.path || p.name}
          onClick={() => setActiveProject(p.id)}
          style={{ boxShadow: `inset 0 0 0 1px ${p.color}33` }}
        >
          <Icon name="folder" size={18} />
        </button>
      ))}
      <button className="project-icon" title="Add repo / folder" onClick={addRepo}>
        <Icon name="plus" size={18} />
      </button>

      <div className="bottom">
        <button
          className={`tool-btn ${sidebarView === "explorer" ? "active" : ""}`}
          title="Explorer"
          onClick={() => setSidebarView("explorer")}
        >
          <Icon name="files" size={20} />
        </button>
        <button
          className={`tool-btn ${sidebarView === "scm" ? "active" : ""}`}
          title="Source Control"
          onClick={() => setSidebarView("scm")}
        >
          <Icon name="git" size={20} />
        </button>
        <span className="rail-divider" />
        <button
          className={`tool-btn ${showPreview ? "active" : ""}`}
          title="Toggle markdown preview"
          onClick={() => toggle("showPreview")}
        >
          <Icon name="preview" size={20} />
        </button>
        <button
          className={`tool-btn ${showClaude ? "active" : ""}`}
          title="Toggle Claude Code"
          onClick={() => toggle("showClaude")}
        >
          <Icon name="sparkles" size={20} />
        </button>
        <button
          className="tool-btn"
          title="Settings"
          onClick={() => toggle("showSettings")}
        >
          <Icon name="settings" size={20} />
        </button>
      </div>
    </nav>
  );
}
