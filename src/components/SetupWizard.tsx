import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { ProjectIconPicker } from "./ProjectIconPicker";
import { useStore } from "../state/store";
import { THEMES } from "../styles/themes";
import { github, openUrl, pickFolder, inTauri, DeviceStart } from "../lib/tauri";

const PROJECT_COLORS = ["#7c8cff", "#6bdc9b", "#ffce6b", "#ff6b9d", "#88c0d0", "#a882ff"];
const STEPS = ["Welcome", "Sign in", "Projects", "Appearance", "All set"];

function Glyph({ icon }: { icon?: string }) {
  if (!icon) return <Icon name="folder" size={18} />;
  if (icon.startsWith("data:")) return <img className="proj-img" src={icon} alt="" />;
  return <span className="proj-emoji">{icon}</span>;
}

// ---- Step: Welcome -------------------------------------------------------
function StepWelcome() {
  return (
    <div className="wiz-pane wiz-center">
      <div className="wiz-mark big">
        <Icon name="sparkles" size={28} />
      </div>
      <h1>Welcome to Anode</h1>
      <p className="wiz-sub">A simple, clean, efficient editor — Claude-native, built from scratch.</p>
      <ul className="wiz-feats">
        <li><Icon name="github" size={16} /> Connect GitHub &amp; manage repos</li>
        <li><Icon name="folder" size={16} /> Add projects and give them icons</li>
        <li><Icon name="palette" size={16} /> Pick a theme or build a palette</li>
        <li><Icon name="sparkles" size={16} /> Claude Code in a side panel</li>
      </ul>
      <p className="wiz-note">Takes about 30 seconds — you can skip any step.</p>
    </div>
  );
}

// ---- Step: Sign in (GitHub device flow + Anode account placeholder) ------
function StepSignIn() {
  const [ghUser, setGhUser] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceStart | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (inTauri) github.user().then(setGhUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!device) return;
    let active = true;
    let t = 0;
    const poll = async () => {
      if (!active) return;
      try {
        const login = await github.devicePoll(device.device_code);
        if (login) {
          setGhUser(login);
          setDevice(null);
          return;
        }
      } catch (e) {
        setErr(String(e));
        setDevice(null);
        return;
      }
      t = window.setTimeout(poll, (device.interval || 5) * 1000);
    };
    t = window.setTimeout(poll, (device.interval || 5) * 1000);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [device]);

  async function start() {
    setErr(null);
    try {
      const d = await github.deviceStart();
      setDevice(d);
      openUrl(d.verification_uri);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="wiz-pane">
      <h2>Sign in</h2>
      <p className="wiz-sub">Connect GitHub to push, pull and clone. Optional — skip anytime.</p>

      <div className="wiz-prov-row">
        <div className="wiz-prov">
          <Icon name="github" size={22} />
        </div>
        <div className="wiz-prov-body">
          <div className="wiz-prov-title">GitHub</div>
          <div className="wiz-prov-sub">
            {ghUser ? `Signed in as ${ghUser}` : "Push, pull and clone your repositories."}
          </div>
        </div>
        {ghUser ? (
          <span className="wiz-ok">
            <Icon name="check" size={16} />
          </span>
        ) : device ? (
          <div className="wiz-device">
            <span className="wiz-code">{device.user_code}</span>
            <button className="wiz-mini" onClick={() => openUrl(device.verification_uri)}>
              Open GitHub
            </button>
          </div>
        ) : (
          <button className="wiz-mini primary" onClick={start} disabled={!inTauri}>
            Sign in
          </button>
        )}
      </div>
      {err && <div className="wiz-err">{err}</div>}

      <div className="wiz-prov-row muted">
        <div className="wiz-prov">
          <Icon name="sync" size={22} />
        </div>
        <div className="wiz-prov-body">
          <div className="wiz-prov-title">Anode account</div>
          <div className="wiz-prov-sub">
            Sync settings &amp; palettes — sign in from Settings → Account Sync.
          </div>
        </div>
        <span className="wiz-soon">later</span>
      </div>
    </div>
  );
}

// ---- Step: Projects + icons ----------------------------------------------
function StepProjects() {
  const projects = useStore((s) => s.projects);
  const addProject = useStore((s) => s.addProject);
  const [picker, setPicker] = useState<{ id: string; x: number; y: number } | null>(null);

  async function add() {
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
    <div className="wiz-pane">
      <h2>Your projects</h2>
      <p className="wiz-sub">Add folders or repos. Click a project to give it an emoji or image icon.</p>
      <div className="wiz-projects">
        {projects.map((p) => (
          <button
            key={p.id}
            className="wiz-proj"
            onClick={(e) => setPicker({ id: p.id, x: e.clientX, y: e.clientY })}
          >
            <span className="wiz-proj-glyph" style={{ boxShadow: `inset 0 0 0 1px ${p.color}44` }}>
              <Glyph icon={p.icon} />
            </span>
            <span className="wiz-proj-name">{p.name}</span>
            {!p.path && <span className="wiz-proj-tag">no folder</span>}
          </button>
        ))}
        <button className="wiz-proj add" onClick={add} disabled={!inTauri}>
          <span className="wiz-proj-glyph">
            <Icon name="plus" size={18} />
          </span>
          <span className="wiz-proj-name">Add folder…</span>
        </button>
      </div>
      {picker && (
        <ProjectIconPicker
          project={projects.find((p) => p.id === picker.id)!}
          x={picker.x}
          y={picker.y}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

// ---- Step: Appearance ----------------------------------------------------
function StepAppearance() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <div className="wiz-pane">
      <h2>Appearance</h2>
      <p className="wiz-sub">Pick a theme — fine-tune everything later in Settings.</p>
      <div className="theme-grid">
        {THEMES.map((th) => (
          <div
            key={th.id}
            className={`theme-card ${
              !settings.customAccent && !settings.customTheme && settings.themeId === th.id
                ? "active"
                : ""
            }`}
            onClick={() => {
              setSetting("themeId", th.id);
              setSetting("customAccent", null);
              setSetting("customTheme", null);
            }}
          >
            <div className="swatches">
              {["--bg", "--bg-panel", "--accent", "--text"].map((v) => (
                <div key={v} className="sw" style={{ background: th.vars[v] }} />
              ))}
            </div>
            <div className="nm">{th.name}</div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <label>Accent color</label>
        <input
          type="color"
          value={settings.customAccent ?? "#7c8cff"}
          onChange={(e) => {
            setSetting("customTheme", null);
            setSetting("customAccent", e.target.value);
          }}
        />
      </div>
    </div>
  );
}

// ---- Step: Finish --------------------------------------------------------
function StepFinish() {
  return (
    <div className="wiz-pane wiz-center">
      <div className="wiz-mark big ok">
        <Icon name="check" size={30} />
      </div>
      <h1>You're all set</h1>
      <p className="wiz-sub">
        Anode is ready. Use the menu bar up top, open Claude on the right, or just start editing.
      </p>
    </div>
  );
}

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dismissWelcome = useStore((s) => s.dismissWelcome);

  function finish() {
    dismissWelcome();
    onClose();
  }

  return (
    <div className="wiz-overlay">
      <div className="wiz-card">
        <div className="wiz-steps">
          {STEPS.map((label, i) => (
            <div key={label} className={`wiz-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
              <span className="wiz-dot">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
              <span className="wiz-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="wiz-body">
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepSignIn />}
          {step === 2 && <StepProjects />}
          {step === 3 && <StepAppearance />}
          {step === 4 && <StepFinish />}
        </div>

        <div className="wiz-foot">
          <button className="wiz-skip" onClick={finish}>
            Skip setup
          </button>
          <span style={{ flex: 1 }} />
          {step > 0 && (
            <button className="wiz-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="wiz-primary" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button className="wiz-primary" onClick={finish}>
              Open Anode
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
