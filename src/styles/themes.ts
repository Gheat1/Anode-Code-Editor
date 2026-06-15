// A theme is just a set of CSS custom properties. Every color in the app reads
// from these variables, so switching themes — or generating one from a single
// accent via the palette chooser — stays perfectly consistent.

export type ThemeVars = Record<string, string>;

export interface Theme {
  id: string;
  name: string;
  vars: ThemeVars;
}

// Base structural variables shared by all dark themes. Individual themes
// override the handful that actually differ.
const darkBase: ThemeVars = {
  "--bg": "#0e0e12",
  "--bg-elev": "#16161d",
  "--bg-panel": "#1b1b23",
  "--bg-hover": "#23232d",
  "--bg-active": "#2b2b37",
  "--border": "#26262f",
  "--text": "#e6e6ee",
  "--text-dim": "#a0a0b0",
  "--text-faint": "#6c6c7c",
  "--accent": "#7c8cff",
  "--accent-soft": "#7c8cff22",
  "--danger": "#ff6b6b",
  "--warning": "#ffce6b",
  "--success": "#6bdc9b",
  "--caret": "#7c8cff",
  "--selection": "#7c8cff33",
};

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    vars: { ...darkBase },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    vars: {
      ...darkBase,
      "--bg": "#1e1e1e",
      "--bg-elev": "#262626",
      "--bg-panel": "#2a2a2a",
      "--bg-hover": "#333333",
      "--bg-active": "#3d3d3d",
      "--border": "#363636",
      "--accent": "#a882ff",
      "--accent-soft": "#a882ff22",
      "--caret": "#a882ff",
      "--selection": "#a882ff33",
    },
  },
  {
    id: "nord",
    name: "Nord",
    vars: {
      ...darkBase,
      "--bg": "#2e3440",
      "--bg-elev": "#3b4252",
      "--bg-panel": "#434c5e",
      "--bg-hover": "#4c566a",
      "--bg-active": "#566080",
      "--border": "#3b4252",
      "--text": "#eceff4",
      "--text-dim": "#d8dee9",
      "--accent": "#88c0d0",
      "--accent-soft": "#88c0d022",
      "--caret": "#88c0d0",
      "--selection": "#88c0d033",
    },
  },
  {
    id: "rose",
    name: "Rosé",
    vars: {
      ...darkBase,
      "--bg": "#191724",
      "--bg-elev": "#1f1d2e",
      "--bg-panel": "#26233a",
      "--bg-hover": "#2f2b45",
      "--bg-active": "#393552",
      "--border": "#2a2740",
      "--text": "#e0def4",
      "--accent": "#ebbcba",
      "--accent-soft": "#ebbcba22",
      "--caret": "#ebbcba",
      "--selection": "#ebbcba33",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    vars: {
      ...darkBase,
      "--bg": "#2a2a2d",
      "--bg-elev": "#303033",
      "--bg-panel": "#363639",
      "--bg-hover": "#3f3f43",
      "--bg-active": "#4a4a4f",
      "--border": "#3c3c40",
      "--text": "#e8e8ea",
      "--text-dim": "#aeaeb4",
      "--text-faint": "#76767e",
      "--accent": "#9aa0aa",
      "--accent-soft": "#9aa0aa22",
      "--caret": "#c7ccd4",
      "--selection": "#9aa0aa33",
    },
  },
  {
    id: "oled",
    name: "OLED",
    vars: {
      ...darkBase,
      "--bg": "#000000",
      "--bg-elev": "#0a0a0c",
      "--bg-panel": "#0d0d10",
      "--bg-hover": "#17171b",
      "--bg-active": "#212127",
      "--border": "#191920",
      "--text": "#f2f2f5",
      "--text-dim": "#9a9aa4",
      "--text-faint": "#5a5a64",
      "--accent": "#7c8cff",
      "--accent-soft": "#7c8cff1f",
      "--caret": "#7c8cff",
      "--selection": "#7c8cff2e",
    },
  },
  {
    id: "paper",
    name: "Paper (Light)",
    vars: {
      "--bg": "#f6f6f4",
      "--bg-elev": "#ffffff",
      "--bg-panel": "#eeeeec",
      "--bg-hover": "#e4e4e1",
      "--bg-active": "#d9d9d5",
      "--border": "#dcdcd8",
      "--text": "#1d1d22",
      "--text-dim": "#55555f",
      "--text-faint": "#8a8a94",
      "--accent": "#5a6cff",
      "--accent-soft": "#5a6cff1a",
      "--danger": "#d83b3b",
      "--warning": "#c98a00",
      "--success": "#1f9d5a",
      "--caret": "#5a6cff",
      "--selection": "#5a6cff22",
    },
  },
];

// Mix a hex color toward white/black by `amount` (-1..1). Used by the palette
// chooser to derive a full, consistent variable set from one accent color.
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c: number) => Math.round((t - c) * p + c);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

// Build a coherent theme from a single accent + base background.
export function themeFromAccent(accent: string, base: string): ThemeVars {
  return {
    ...darkBase,
    "--bg": base,
    "--bg-elev": shade(base, 0.04),
    "--bg-panel": shade(base, 0.08),
    "--bg-hover": shade(base, 0.12),
    "--bg-active": shade(base, 0.18),
    "--border": shade(base, 0.1),
    "--accent": accent,
    "--accent-soft": accent + "22",
    "--caret": accent,
    "--selection": accent + "33",
  };
}

export function applyTheme(vars: ThemeVars) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

// The solid colors exposed in the custom-palette editor. `--accent-soft` and
// `--selection` are derived from `--accent` automatically (they carry alpha).
export const EDITABLE_VARS: { key: string; label: string }[] = [
  { key: "--bg", label: "Background" },
  { key: "--bg-elev", label: "Elevated surface" },
  { key: "--bg-panel", label: "Panel" },
  { key: "--bg-hover", label: "Hover" },
  { key: "--bg-active", label: "Active / selected" },
  { key: "--border", label: "Border" },
  { key: "--text", label: "Text" },
  { key: "--text-dim", label: "Text — dim" },
  { key: "--text-faint", label: "Text — faint" },
  { key: "--accent", label: "Accent" },
  { key: "--danger", label: "Error" },
  { key: "--warning", label: "Warning" },
  { key: "--success", label: "Success" },
  { key: "--caret", label: "Caret" },
];

// Snapshot the currently-applied theme into a full, editable vars map.
export function currentThemeVars(): ThemeVars {
  const cs = getComputedStyle(document.documentElement);
  const out: ThemeVars = {};
  const keys = [...EDITABLE_VARS.map((v) => v.key), "--accent-soft", "--selection"];
  for (const k of keys) out[k] = cs.getPropertyValue(k).trim() || "#000000";
  return out;
}

// Keep the alpha-bearing variables consistent with the chosen accent.
export function deriveTheme(vars: ThemeVars): ThemeVars {
  const accent = vars["--accent"] || "#7c8cff";
  return {
    ...vars,
    "--accent-soft": accent + "22",
    "--selection": accent + "33",
  };
}
