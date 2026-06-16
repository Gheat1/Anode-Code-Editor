import { useState } from "react";
import { Icon, IconName } from "./Icon";
import { AccountSync } from "./AccountSync";
import { useStore, DEFAULT_SETTINGS, Settings } from "../state/store";
import {
  THEMES,
  EDITABLE_VARS,
  currentThemeVars,
  deriveTheme,
} from "../styles/themes";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <div className="knob" />
    </div>
  );
}

const FONT_OPTIONS = [
  "'Inter', system-ui, sans-serif",
  "'Segoe UI', system-ui, sans-serif",
  "'SF Pro Display', system-ui, sans-serif",
  "system-ui, sans-serif",
];
const MONO_OPTIONS = [
  "'JetBrains Mono', monospace",
  "'Cascadia Code', monospace",
  "'Fira Code', monospace",
  "'Consolas', monospace",
];
const MODEL_OPTIONS = [
  "claude-fable-5",
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "opus",
  "sonnet",
  "haiku",
];

type SectionId = "appearance" | "typography" | "editor" | "claude" | "sync";
const SECTIONS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "typography", label: "Typography", icon: "type" },
  { id: "editor", label: "Editor", icon: "sliders" },
  { id: "claude", label: "Claude Code", icon: "sparkles" },
  { id: "sync", label: "Account Sync", icon: "sync" },
];

export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const toggle = useStore((s) => s.toggle);
  const section = useStore((s) => s.settingsSection) as SectionId;
  const setSection = useStore((s) => s.setSettingsSection);
  const [paletteName, setPaletteName] = useState("");

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setSetting(k, v);
  }

  const savedPalettes = settings.savedPalettes ?? [];

  function savePalette() {
    const name = paletteName.trim();
    if (!name || !settings.customTheme) return;
    const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    set("savedPalettes", [...savedPalettes, { id, name, vars: settings.customTheme }]);
    setPaletteName("");
  }
  function applyPalette(vars: Record<string, string>) {
    set("customAccent", null);
    set("customTheme", vars);
  }
  function deletePalette(id: string) {
    set("savedPalettes", savedPalettes.filter((p) => p.id !== id));
  }

  function exportSettings() {
    navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
  }
  async function importSettings() {
    try {
      const parsed = JSON.parse(await navigator.clipboard.readText()) as Settings;
      (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).forEach((k) =>
        set(k, (parsed[k] ?? DEFAULT_SETTINGS[k]) as never)
      );
    } catch {
      /* ignore malformed clipboard */
    }
  }

  const activeLabel = (SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]).label;

  return (
    <div className="settings-overlay" onClick={() => toggle("showSettings")}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          <div className="sn-title">Settings</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`snav-item ${section === s.id ? "active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <Icon name={s.icon} size={16} />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-main">
          <div className="sc-head">
            <h2>{activeLabel}</h2>
            <button className="done" onClick={() => toggle("showSettings")}>
              Done
            </button>
          </div>
          <div className="settings-content">
            {section === "appearance" && (
              <>
                <div className="group">
                  <label>Theme</label>
                  <div className="theme-grid">
                    {THEMES.map((th) => (
                      <div
                        key={th.id}
                        className={`theme-card ${
                          !settings.customAccent &&
                          !settings.customTheme &&
                          settings.themeId === th.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() => {
                          set("themeId", th.id);
                          set("customAccent", null);
                          set("customTheme", null);
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
                    {savedPalettes.map((sp) => {
                      const active =
                        !!settings.customTheme &&
                        JSON.stringify(settings.customTheme) === JSON.stringify(sp.vars);
                      return (
                        <div
                          key={sp.id}
                          className={`theme-card ${active ? "active" : ""}`}
                          onClick={() => applyPalette(sp.vars)}
                        >
                          <div className="swatches">
                            {["--bg", "--bg-panel", "--accent", "--text"].map((v) => (
                              <div key={v} className="sw" style={{ background: sp.vars[v] }} />
                            ))}
                          </div>
                          <div className="nm">
                            <span className="nm-text">{sp.name}</span>
                            <button
                              className="card-del"
                              title="Delete palette"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePalette(sp.id);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="group">
                  <label>Quick palette (from one accent)</label>
                  <div className="row">
                    <label>Accent color</label>
                    <input
                      type="color"
                      value={settings.customAccent ?? "#7c8cff"}
                      onChange={(e) => {
                        set("customTheme", null);
                        set("customAccent", e.target.value);
                      }}
                    />
                  </div>
                  <div className="row">
                    <label>Background base</label>
                    <input
                      type="color"
                      value={settings.customBase}
                      onChange={(e) => {
                        set("customTheme", null);
                        set("customAccent", settings.customAccent ?? "#7c8cff");
                        set("customBase", e.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="group">
                  <label>Custom palette — every color</label>
                  {!settings.customTheme ? (
                    <div className="row">
                      <label style={{ color: "var(--text-faint)" }}>
                        Start from the current theme, then tweak any color.
                      </label>
                      <button
                        className="done"
                        onClick={() => set("customTheme", deriveTheme(currentThemeVars()))}
                      >
                        Create custom palette
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="palette-grid">
                        {EDITABLE_VARS.map((v) => (
                          <label key={v.key} className="palette-swatch" title={v.key}>
                            <input
                              type="color"
                              value={settings.customTheme![v.key] || "#000000"}
                              onChange={(e) =>
                                set(
                                  "customTheme",
                                  deriveTheme({
                                    ...settings.customTheme!,
                                    [v.key]: e.target.value,
                                  })
                                )
                              }
                            />
                            <span>{v.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="row" style={{ marginTop: 14, gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Name this palette…"
                          value={paletteName}
                          onChange={(e) => setPaletteName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && savePalette()}
                          style={{ flex: 1 }}
                        />
                        <button className="done" disabled={!paletteName.trim()} onClick={savePalette}>
                          Save palette
                        </button>
                      </div>
                      <div className="row">
                        <label style={{ color: "var(--text-faint)" }}>
                          Saved palettes appear with the themes above.
                        </label>
                        <button
                          className="done"
                          style={{ background: "var(--bg-active)" }}
                          onClick={() => set("customTheme", null)}
                        >
                          Remove custom palette
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="group">
                  <label>Window</label>
                  <div className="row">
                    <label>Blurred background (Windows acrylic)</label>
                    <Toggle on={settings.blurEnabled} onChange={(v) => set("blurEnabled", v)} />
                  </div>
                </div>
              </>
            )}

            {section === "typography" && (
              <div className="group">
                <label>Fonts (apply app-wide)</label>
                <div className="row">
                  <label>Interface font</label>
                  <input
                    type="text"
                    list="ui-fonts"
                    value={settings.fontFamily}
                    placeholder="Type any installed font…"
                    onChange={(e) => set("fontFamily", e.target.value)}
                    style={{ width: 240 }}
                  />
                  <datalist id="ui-fonts">
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div className="row">
                  <label>Editor font</label>
                  <input
                    type="text"
                    list="mono-fonts"
                    value={settings.editorFontFamily}
                    placeholder="Type any installed monospace font…"
                    onChange={(e) => set("editorFontFamily", e.target.value)}
                    style={{ width: 240 }}
                  />
                  <datalist id="mono-fonts">
                    {MONO_OPTIONS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div className="row">
                  <label>Base size</label>
                  <input
                    type="number"
                    min={11}
                    max={20}
                    value={settings.fontSize}
                    onChange={(e) => set("fontSize", Number(e.target.value))}
                    style={{ width: 70 }}
                  />
                </div>
              </div>
            )}

            {section === "editor" && (
              <div className="group">
                <label>Editor</label>
                <div className="row">
                  <label>Smooth caret animation</label>
                  <Toggle on={settings.smoothCaret} onChange={(v) => set("smoothCaret", v)} />
                </div>
                <div className="row">
                  <label>Line numbers</label>
                  <Toggle on={settings.lineNumbers} onChange={(v) => set("lineNumbers", v)} />
                </div>
                <div className="row">
                  <label>Show .claude folder in explorer</label>
                  <Toggle
                    on={settings.showClaudeFolder}
                    onChange={(v) => set("showClaudeFolder", v)}
                  />
                </div>
              </div>
            )}

            {section === "claude" && (
              <>
                <div className="group">
                  <label>Permissions</label>
                  <div className={`row ${settings.claudeSkipPermissions ? "danger" : ""}`}>
                    <label>Skip all permission checks (dangerous)</label>
                    <Toggle
                      on={settings.claudeSkipPermissions}
                      onChange={(v) => set("claudeSkipPermissions", v)}
                    />
                  </div>
                  {settings.claudeSkipPermissions && (
                    <div className="settings-warn">
                      <Icon name="warning" size={14} /> Adds{" "}
                      <code>--dangerously-skip-permissions</code>. Claude will edit
                      files and run commands without asking. Only use in a trusted
                      sandbox.
                    </div>
                  )}
                  <div className="row">
                    <label>Permission mode</label>
                    <select
                      value={settings.claudePermissionMode}
                      disabled={settings.claudeSkipPermissions}
                      onChange={(e) =>
                        set(
                          "claudePermissionMode",
                          e.target.value as Settings["claudePermissionMode"]
                        )
                      }
                    >
                      <option value="default">Default (ask)</option>
                      <option value="acceptEdits">Accept edits</option>
                      <option value="plan">Plan mode</option>
                    </select>
                  </div>
                </div>

                <div className="group">
                  <label>Session</label>
                  <div className="row">
                    <label>Model</label>
                    <input
                      type="text"
                      list="claude-models"
                      value={settings.claudeModel}
                      placeholder="CLI default"
                      onChange={(e) => set("claudeModel", e.target.value)}
                      style={{ width: 200 }}
                    />
                    <datalist id="claude-models">
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div className="row">
                    <label>Continue last conversation (--continue)</label>
                    <Toggle
                      on={settings.claudeContinue}
                      onChange={(v) => set("claudeContinue", v)}
                    />
                  </div>
                  <div className="row">
                    <label>Verbose output (--verbose)</label>
                    <Toggle
                      on={settings.claudeVerbose}
                      onChange={(v) => set("claudeVerbose", v)}
                    />
                  </div>
                  <div className="row">
                    <label>Extra flags</label>
                    <input
                      type="text"
                      value={settings.claudeExtraFlags}
                      placeholder="--add-dir ../lib"
                      onChange={(e) => set("claudeExtraFlags", e.target.value)}
                      style={{ width: 220 }}
                    />
                  </div>
                  <div className="row">
                    <label style={{ color: "var(--text-faint)" }}>
                      Model and extra flags apply on the next session — hit ↻ in the
                      Claude panel.
                    </label>
                  </div>
                </div>
              </>
            )}

            {section === "sync" && (
              <>
                <div className="group">
                  <label>Anode account</label>
                  <AccountSync />
                </div>
                <div className="group">
                  <label>Manual backup</label>
                  <div className="row">
                    <label style={{ color: "var(--text-faint)" }}>
                      No account? Copy your settings blob to move them between
                      machines by hand.
                    </label>
                  </div>
                  <div className="row">
                    <button
                      className="done"
                      style={{ background: "var(--bg-active)" }}
                      onClick={exportSettings}
                    >
                      Copy settings
                    </button>
                    <button
                      className="done"
                      style={{ background: "var(--bg-active)" }}
                      onClick={importSettings}
                    >
                      Paste settings
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
