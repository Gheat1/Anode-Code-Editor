# CLAUDE.md — Anode

This file is the complete guide to the **Anode** codebase for AI models and
contributors. It documents the architecture, every module, the full IPC surface,
conventions, and step‑by‑step recipes for common changes. Read the section you
need; everything here reflects the current state of the repo.

---

## 1. What Anode is

**Anode** — *"A Simple, Clean, Efficient Editor."* — is a Claude‑native desktop
code editor for Windows, macOS, and Linux, built **from scratch (not on VS
Code)**.

- **Version:** 1.3.2 · **Author/Publisher:** Gheat · **Copyright:** © 2026 Gheat
- **Bundle identifier:** `com.anode.editor`
- **Primary platform:** Windows (acrylic blur, DWM rounded corners). macOS/Linux
  are fully supported with graceful fallbacks.

Signature features: an embedded **Claude Code** CLI (real `claude`, no API key),
a VS Code‑style **Source Control** panel with GitHub device‑flow login, an
integrated **terminal**, **split editing**, a deep **theme/palette** system with
saved palettes, **project switching** with emoji/image icons, a custom
**smooth‑caret** editor, and a first‑run **setup wizard**.

---

## 2. Tech stack

| Layer            | Choice |
| ---------------- | ------ |
| Desktop shell    | **Tauri 2** (Rust core + system WebView2/WKWebView/webkit2gtk) |
| Frontend         | **React 19** + **TypeScript** + **Vite 6** |
| Code editor      | **CodeMirror 6** (modular; chosen over Monaco to avoid the VS Code engine) |
| Terminal UI      | **@xterm/xterm** + **@xterm/addon-fit** |
| Markdown         | **markdown-it** (+ anchor, task-lists) |
| State            | **zustand** (+ `persist` middleware → `localStorage`) |
| Rust deps        | `tauri`, `tauri-plugin-dialog`, `portable-pty`, `reqwest`, `window-vibrancy`, `base64`, `serde`/`serde_json` |

Why Tauri over Electron: tiny installers (uses the OS webview), low RAM, and
native Windows acrylic. Why CodeMirror over Monaco: Monaco *is* the VS Code
editor; CM6 is lighter and lets us implement a custom animated caret.

---

## 3. Commands

```bash
npm install            # install JS deps (run once)
npm run app            # tauri dev — Vite on :1420 + native window (full app)
npm run dev            # Vite only, in a browser (native features are stubbed)
npm run build          # tsc --noEmit type-check, then vite production build
npm run app:build      # tauri build — produces installers in src-tauri/target/release/bundle/
npm run tauri -- icon path/to/1024.png   # regenerate the cross-platform icon set
```

**Verification loop after edits** (this is how every change in this repo is
checked):

```bash
npx tsc --noEmit                          # frontend type-check
npx vite build                            # frontend bundles
cd src-tauri && cargo check               # Rust compiles
```

Notes:
- Vite is pinned to port **1420** (`vite.config.ts`, `strictPort`). Tauri's
  `beforeDevCommand` launches it.
- The first `cargo` build compiles all crates and takes minutes; later builds are
  incremental.
- The frontend type-checks and bundles independently of Rust, so iterate on UI
  with `tsc`/`vite build` and only run `cargo check` when Rust changes.

---

## 4. Directory layout

```
Anode Code Editor/
├── package.json            # scripts + JS deps; version/description/author
├── vite.config.ts          # Vite (port 1420, ignores src-tauri)
├── tsconfig.json           # strict TS; path alias @/* -> src/*
├── tsconfig.node.json
├── index.html              # mounts #root -> src/main.tsx
├── README.md               # user-facing: run, build per-OS, install, GitHub
├── CLAUDE.md               # this file
│
├── src/                                  # FRONTEND (React/TS)
│   ├── main.tsx                          # React root render + global.css import
│   ├── App.tsx                           # app shell, layout, global keybindings, effects
│   ├── state/
│   │   └── store.ts                      # zustand store: Settings + workspace + persist + syncAppearance()
│   ├── styles/
│   │   ├── themes.ts                     # theme presets, palette generators, applyTheme()
│   │   └── global.css                    # ALL styling, driven by CSS variables
│   ├── editor/
│   │   ├── setup.ts                      # CodeMirror extensions, languages, syntax highlight
│   │   ├── smoothCaret.ts                # custom animated caret (ViewPlugin)
│   │   ├── linter.ts                     # demo diagnostics -> error/warning underlines
│   │   └── activeView.ts                 # tracks the focused editor + its file id (for split)
│   ├── lib/
│   │   ├── tauri.ts                      # typed wrappers around ALL Rust commands + events
│   │   └── actions.ts                    # app-level actions (save, open folder, editor cmds)
│   ├── components/
│   │   ├── TitleBar.tsx                  # frameless title bar: brand, menu bar, file info, diagnostics, window buttons
│   │   ├── MenuBar.tsx                   # File/Edit/View/Terminal/Help dropdown menus
│   │   ├── ActivityBar.tsx               # left rail: project switcher + view toggles + tool buttons
│   │   ├── ProjectIconPicker.tsx         # popover: emoji grid, tint, upload png/svg
│   │   ├── Sidebar.tsx                   # explorer (FS tree) OR Source Control, resizable
│   │   ├── SourceControl.tsx             # VS Code-style SCM: branch bar, commit, sync, files, history, GitHub login
│   │   ├── EditorArea.tsx                # tabs + editor host (single/split) + preview + terminal
│   │   ├── EditorPane.tsx                # one CodeMirror instance bound to a file id
│   │   ├── MarkdownPreview.tsx           # Obsidian-style markdown render
│   │   ├── ClaudePanel.tsx               # right panel: Claude Code terminal + flags + status
│   │   ├── TerminalPanel.tsx             # bottom integrated shell
│   │   ├── XtermView.tsx                 # reusable xterm.js <-> PTY bridge
│   │   ├── SettingsPanel.tsx             # sectioned settings modal with icon nav
│   │   ├── SetupWizard.tsx               # first-run onboarding (welcome, sign in, projects, appearance)
│   │   ├── ResizeHandle.tsx              # draggable divider (x or y axis)
│   │   ├── FileLabel.tsx                 # filename that truncates base, keeps extension
│   │   └── Icon.tsx                      # monochrome currentColor SVG icon pack
│   └── types/
│       └── shims.d.ts                    # module decl for markdown-it-task-lists
│
└── src-tauri/                            # BACKEND (Rust + Tauri)
    ├── Cargo.toml                        # crate deps; version/author
    ├── build.rs                          # tauri_build::build()
    ├── tauri.conf.json                   # window, bundle, security config
    ├── capabilities/default.json         # permission allowlist for the main window
    ├── icons/                            # generated icon set (.ico, .icns, png, mobile)
    └── src/
        ├── main.rs                       # binary entry; calls anode_lib::run()
        └── lib.rs                        # ALL Tauri commands + window setup
```

There is **no `src/data/`** — the old `welcome.ts` demo files were removed.

---

## 5. Architecture overview

```
┌─────────────────────── WebView (React) ───────────────────────┐
│  App.tsx (layout + keybindings + appearance/blur effects)     │
│   ├─ TitleBar ── MenuBar                                       │
│   ├─ ActivityBar (projects, view switch, tool toggles)        │
│   ├─ Sidebar → Explorer (FS tree) | SourceControl             │
│   ├─ EditorArea → tabs → EditorPane(s) | MarkdownPreview       │
│   │                     └─ TerminalPanel (XtermView "terminal")│
│   ├─ ClaudePanel → XtermView "claude"                          │
│   ├─ SettingsPanel (modal)                                    │
│   └─ SetupWizard (first run)                                  │
│                                                               │
│  zustand store (state/store.ts) ── persisted to localStorage  │
│  lib/tauri.ts  ── invoke<T>(cmd) + event listeners            │
└───────────────────────────┬───────────────────────────────────┘
                            │ Tauri IPC (commands + events)
┌───────────────────────────┴───────────────────────────────────┐
│  src-tauri/src/lib.rs (Rust)                                  │
│   • window: set_blur (acrylic), round_corners (DWM)           │
│   • fs: read_dir, read_file, write_file, read_image_data_url  │
│   • git: shells out to system `git`                           │
│   • github: OAuth device flow via reqwest                     │
│   • pty: PtyManager (portable-pty) keyed by id                │
│      emits  pty://output {id,chunk} / pty://exit  id          │
└───────────────────────────────────────────────────────────────┘
```

Data flow rules:
- **All native work goes through `lib/tauri.ts`**, which wraps `invoke()` and
  guards with `inTauri` so the UI still renders in a plain browser (`npm run
  dev`). Calling a command outside Tauri throws (or returns a no-op for the
  fire-and-forget wrappers like `setBlur`/`openUrl`).
- **The store is the single source of truth** for UI state and settings.
  Components subscribe with `useStore(selector)`.
- **`syncAppearance(settings)`** (in `store.ts`) is the one place that applies
  theme variables + fonts to the DOM; `App.tsx` calls it whenever `settings`
  changes.

---

## 6. State management (`src/state/store.ts`)

zustand store created with the `persist` middleware. Key name: **`anode-state`**
in `localStorage`. Persist `version: 1`.

### Settings (the synced blob)
`Settings` is one serializable object (account sync = push/pull this). Fields:

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `themeId` | string | active preset id (see §8) |
| `customAccent` | string \| null | accent for the quick palette generator; overrides `themeId` |
| `customBase` | string | base background for the quick palette |
| `customTheme` | Record<string,string> \| null | full hand-tuned palette (**highest priority**) |
| `savedPalettes` | `SavedPalette[]` | user palettes `{id,name,vars}`, shown with presets |
| `fontFamily` | string | app-wide UI font (CSS font stack) |
| `fontSize` | number | base px size, app-wide |
| `editorFontFamily` | string | monospace font for editor + terminals |
| `blurEnabled` | boolean | Windows acrylic on/off |
| `smoothCaret` | boolean | animated caret on/off |
| `lineNumbers` | boolean | editor gutter line numbers |
| `showClaudeFolder` | boolean | show `.claude` in the explorer tree |
| `claudeSkipPermissions` | boolean | → `--dangerously-skip-permissions` |
| `claudePermissionMode` | "default"\|"acceptEdits"\|"plan" | → `--permission-mode` |
| `claudeModel` | string | → `--model` (blank = CLI default) |
| `claudeContinue` | boolean | → `--continue` |
| `claudeVerbose` | boolean | → `--verbose` |
| `claudeExtraFlags` | string | appended raw, split on whitespace |

`DEFAULT_SETTINGS` holds all defaults. Theme priority in `syncAppearance`:
`customTheme` > `customAccent` (via `themeFromAccent`) > `themeId` preset.

### Workspace state (top-level AppState)
`projects: Project[]`, `activeProjectId`, `openFiles: OpenFile[]`,
`activeFileId`, plus UI flags: `showPreview`, `showClaude`, `showSettings`,
`showSidebar`, `showTerminal`, `splitView`, `splitFileId`, `splitWidth`,
`welcomeDismissed`, `sidebarView` ("explorer"|"scm"), `sidebarWidth`,
`claudeWidth`, `terminalHeight`.

`Project = { id, name, path, color, icon? }` — `icon` is an emoji char **or** a
`data:` URL (uploaded png/svg). The seed project is `{id:"home", name:"Home",
path:""}`; a project with an empty `path` shows an "add a folder" hint.

`OpenFile = { id, name, path, language, content, dirty }`. `id` is the absolute
path for real files.

### Actions
`setSetting<K>(key,value)`, `setSidebarView`, `setSidebarWidth`,
`setClaudeWidth`, `setTerminalHeight`, `setSplitFile`, `setSplitWidth`,
`dismissWelcome`, `updateProject(id, patch)`, `markSaved(id)`, `addProject`,
`setActiveProject`, `openFile`, `closeFile`, `setActiveFile`,
`updateFileContent`, and a generic `toggle(key)` for the boolean UI flags.

### Persistence: `migrate` + `merge`
- **`migrate`** (runs when stored `version < 1`): strips the legacy `welcome.md`
  / `scratch.ts` open files and the old `demo`/"Welcome" project.
- **`merge`** (every rehydrate): deep-merges `settings` over `DEFAULT_SETTINGS`
  so newly added settings fields pick up defaults for existing users. **When you
  add a setting, no migration is needed — `merge` handles it.** When you change
  top-level workspace shape destructively, bump `version` and extend `migrate`.

> Note: `Date.now()` / `Math.random()` are fine to use in the app (used for
> palette ids). The restriction on those only applies to Workflow tool scripts,
> not this React app.

---

## 7. Appearance & CSS conventions (`styles/global.css`, `styles/themes.ts`)

**Everything is driven by CSS custom properties.** Components never hardcode
colors; they read variables so themes/palettes stay consistent.

### Core theme variables
`--bg`, `--bg-elev`, `--bg-panel`, `--bg-hover`, `--bg-active`, `--border`,
`--text`, `--text-dim`, `--text-faint`, `--accent`, `--accent-soft`, `--danger`,
`--warning`, `--success`, `--caret`, `--selection`. `applyTheme(vars)` sets them
on `document.documentElement`.

### Surface variables (blur-aware)
Panels use `--surface`, `--surface-panel`, `--surface-bar`, `--surface-tab`,
**not** raw `--bg*`. Defaults are ~85% opaque (acrylic shows through). When blur
is off, `body.no-blur` overrides them to **solid** exact colors — so a pitch‑black
palette renders pitch black. **Acrylic blur shows the desktop through, so a
surface can't be both opaque‑exact and blurred at once.** `App.tsx` forces
`no-blur` on non‑Windows (acrylic is Windows-only).

### Layout variables
`--titlebar-h` (36), `--activitybar-w` (56), `--radius` (10), `--app-font`,
`--editor-font`, `--app-font-size`.

### Other conventions
- `.app` has `border-radius:10px; overflow:hidden` + a hairline border; the
  native window is rounded by DWM on Win11 so acrylic clips to it.
- Icons are `currentColor` SVGs and must not shrink: `svg { flex-shrink: 0 }`.
- Animations live at the bottom of `global.css` (`pop-in`, `fade-in`,
  `scale-in`, `slide-up/left/right`, `pulse`) with a `prefers-reduced-motion`
  guard.
- CodeMirror is themed via `.cm-*` rules + a `HighlightStyle` built in `setup.ts`
  from computed CSS variables.

### Theme presets (`THEMES` in `themes.ts`)
`midnight` (default), `obsidian`, `nord`, `rose`, `graphite` (dark grey), `oled`
(true black), `paper` (light).

Helpers: `themeFromAccent(accent, base)` builds a full palette from one accent;
`shade(hex, amount)` lightens/darkens; `EDITABLE_VARS` lists the colors the
custom-palette editor exposes; `currentThemeVars()` snapshots the applied theme;
`deriveTheme(vars)` keeps `--accent-soft`/`--selection` in sync with `--accent`.

---

## 8. Rust backend (`src-tauri/src/lib.rs`)

`main.rs` is a thin entry that calls `anode_lib::run()`. `run()` registers the
dialog plugin, manages `PtyManager`, applies acrylic + rounds corners on Windows
at setup, and registers the command handler.

### Window
- `round_corners(window)` — **Windows only**; calls `DwmSetWindowAttribute`
  (`DWMWA_WINDOW_CORNER_PREFERENCE = 33`, `DWMWCP_ROUND = 2`) via a small
  `dwmapi` FFI so the frameless transparent window gets rounded corners.
- `set_blur(enabled)` — **Windows only**; `apply_acrylic` / `clear_acrylic` from
  `window-vibrancy` with tint `(18,18,22,125)`. No-op elsewhere.

### Filesystem (std::fs — no plugin, so no scope restrictions)
- `read_dir(path) -> Vec<DirEntry{name,path,is_dir}>` — sorts dirs first,
  alpha; **skips** `node_modules`, `target`, `.git`. (`.claude` is filtered in
  the frontend based on the setting, not here.)
- `read_file(path) -> String`
- `write_file(path, contents)`
- `read_image_data_url(path) -> String` — base64-encodes an image to a `data:`
  URL (mime from extension); used for project icon upload.

### Git (shells out to system `git` via `Command`, reusing the user's credential manager)
- `git_available() -> bool`
- `git_init(path)`
- `git_status(path) -> GitStatus{branch,dirty,files}` (used by TitleBar)
- `git_info(path) -> GitInfo{is_repo,branch,has_commits,files:[{path,status}],ahead,behind,remote,upstream}` (used by SourceControl)
- `git_log(path, limit) -> Vec<Commit{hash,short,author,date,subject}>` (uses `\x1f`-separated `--pretty`)
- `git_pull` (`pull --ff-only`), `git_push` (`push`), `git_publish` (`push -u origin HEAD` — first push)
- `git_commit_all(path, message)` (`add -A` then `commit -m`)

### GitHub (OAuth Device Flow via `reqwest`)
- Client ID is **baked in**: `GITHUB_CLIENT_ID = "Ov23liIFael6ExmouS1c"`
  (client IDs are public; device flow has no secret). Override with env
  `ANODE_GITHUB_CLIENT_ID`.
- `github_device_start() -> DeviceStart{user_code,verification_uri,device_code,interval}`
- `github_device_poll(device_code) -> Option<String>` — `None` while pending,
  `Some(login)` on success; stores the token and runs `gh auth login
  --with-token` if `gh` is present.
- `github_user() -> Option<String>` — identity from the stored token, else falls
  back to `gh api user`.
- `github_logout()` — deletes the stored token.
- Token is stored at `app_config_dir()/github.json`.

### Misc
- `open_url(url)` — opens in the default browser: `cmd /c start` (Windows),
  `open` (macOS), `xdg-open` (Linux).

### Pseudo-terminals (`portable-pty`, keyed pool)
`PtyManager { sessions: Mutex<HashMap<String, PtySession>> }` managed as Tauri
state. A reader thread per session streams output.
- `pty_start(id, program: Option<String>, args: Option<Vec<String>>, cwd, cols, rows)` —
  kills any existing session with that id, spawns a PTY. `program == Some("claude")`
  runs Claude Code (on Windows via `cmd /c claude` for the PATHEXT shim) with the
  given `args` appended; anything else opens a shell (`powershell` on Windows,
  `$SHELL`/`bash` elsewhere). Output is emitted as the event **`pty://output`**
  with payload `{id, chunk}`; exit emits **`pty://exit`** with the `id`.
- `pty_write(id, data)`, `pty_resize(id, cols, rows)`, `pty_kill(id)`.

PTY ids in use: **`"claude"`** (ClaudePanel) and **`"terminal"`** (TerminalPanel).

### Capabilities (`capabilities/default.json`)
`core:default`, window start-dragging/minimize/toggle-maximize/close,
`core:event:default`, `dialog:default`, `dialog:allow-open`. Filesystem is via
custom Rust commands, **not** the fs plugin, so no fs scope config is needed.

---

## 9. IPC bridge (`src/lib/tauri.ts`)

`inTauri` (boolean) detects the desktop runtime. `invoke<T>(cmd, args)` throws
outside Tauri. Typed groups:

- `fs.{readDir, readFile, writeFile, readImageDataUrl}`
- `pickFolder()`, `pickImage()` (dialog plugin)
- `git.{available, init, info, log, status, pull, push, publish, commitAll}`
- `github.{deviceStart, devicePoll, user, logout}`
- `openUrl(url)`, `setBlur(enabled)`
- `pty.{start, write, resize, kill}`, `onPtyOutput(cb)`, `onPtyExit(cb)`

**Add a Rust command → add its typed wrapper here.** TS interfaces here mirror
the Rust `Serialize` structs exactly (snake_case fields: `is_dir`, `is_repo`,
`has_commits`, etc.).

---

## 10. Editor (`src/editor/*`, `src/components/EditorPane.tsx`)

- **`setup.ts`** — `baseExtensions({lineNumbers})` (gutters, history, brackets,
  search, autocomplete, lint gutter, keymaps incl. `indentWithTab`,
  line-wrapping), `languageFor(filename)` and `languageName(filename)` (ts/tsx,
  js/jsx, md, py, rs, css, html, json), and `anodeHighlight()` — a
  `HighlightStyle` built from **computed CSS variables** so syntax colors follow
  the theme.
- **`smoothCaret.ts`** — a `ViewPlugin` that draws a `.smooth-caret` div and
  glides it to the cursor with a CSS transition; the native caret is hidden
  (`caret-color: transparent`, toggled by the `no-smooth-caret` class).
- **`linter.ts`** — a demo `@codemirror/lint` linter: `console.log` → **error**,
  `TODO`/`FIXME`/`XXX` → **warning**, trailing whitespace → **warning**. Replace
  with a real LSP later. The TitleBar recomputes the same counts to show
  error/warning badges.
- **`activeView.ts`** — module singleton tracking the focused `EditorView` and
  its file id: `setActiveView(view, fileId)`, `getActiveView()`,
  `getActiveFileId()`. This is how Save/Undo/Redo/Find target the **focused**
  pane in split view.
- **`EditorPane.tsx`** — one CodeMirror instance bound to a file. Prop `fileId?`
  (defaults to the global `activeFileId`; split passes explicit ids). Doc changes
  flow back via `updateFileContent`; on focus it registers itself as the active
  view. Uses a `Compartment` to toggle the smooth caret live without rebuilding.

---

## 11. Terminals & Claude (`XtermView`, `ClaudePanel`, `TerminalPanel`)

- **`XtermView.tsx`** — the reusable bridge. Creates an xterm `Terminal` +
  `FitAddon` themed from CSS variables (transparent background), subscribes to
  `pty://output`/`pty://exit` (filtered by `id`), calls `pty.start(id, program,
  args, cwd, cols, rows)`, forwards keystrokes via `term.onData → pty.write`, and
  resizes via a `ResizeObserver`. Props: `id`, `program`, `args?`, `cwd`,
  `onStatus?`. Reads `args` from a ref so changing flags doesn't force a remount
  (flags apply on the next session).
- **`ClaudePanel.tsx`** — right panel. Renders `XtermView id="claude"
  program="claude"`. `claudeArgs(settings)` builds the CLI flags. Header has a
  badge, title, project name, a **status pill** (pulsing "ready" / "stopped" via
  `onStatus`), a **New session** button (remounts via a `sessionKey`), and close.
  A **"⚠ bypass" pill** appears when `claudeSkipPermissions` is on. Structured
  flag changes auto-restart the session; text flags (model, extra) apply on
  manual restart.
- **`TerminalPanel.tsx`** — bottom shell. Renders `XtermView id="terminal"
  program={null}`. Vertically resizable (`ResizeHandle axis="y"`), opens in the
  active project's folder.

Switching projects changes `cwd`, which remounts the XtermView and restarts the
session in the new folder (expected behavior for both Claude and the terminal).

---

## 12. Git / GitHub UI (`SourceControl.tsx`)

Reached via the git icon in the ActivityBar (sets `sidebarView = "scm"`).
Auto-detects state via `git.available()` + `git.info(path)`:
- **No git** → "Download Git" prompt. **No folder** → hint. **Not a repo** →
  "Initialize Repository". **Repo** → full UI.
- **Branch bar:** `branch › user/repo` with an arrow; `↑N`/`↓N` pills for
  ahead/behind; a ✓ when up to date.
- **Commit box** (Ctrl+Enter), **Sync** button (pull-then-push; **disabled/greyed
  when up to date** = `upstream && ahead==0 && behind==0`; shows "Publish branch"
  when there's a remote but no upstream).
- **Changes** list (status badges) and **Commits** history (`git.log`).
- **GitHub account:** device-flow sign-in (shows the code, opens GitHub, polls),
  signed-in identity, sign out.

---

## 13. Components reference

| Component | Responsibility |
| --------- | -------------- |
| `App` | Layout grid, `syncAppearance` effect, blur effect, global keybindings, mounts modals |
| `TitleBar` | Frameless drag bar: brand, `MenuBar`, active file + language, diagnostics, git branch, window controls (min/max/close via `@tauri-apps/api/window`) |
| `MenuBar` | Dropdown menus (File/Edit/View/Terminal/Help); actions call `lib/actions` + store toggles; closes on outside click/Escape |
| `ActivityBar` | Project switcher (click=activate, right-click=icon picker), Explorer/SCM view switch, preview/Claude/Settings toggles |
| `ProjectIconPicker` | Fixed popover: 40 emojis, tint colors, "Upload PNG/SVG", reset |
| `Sidebar` | Width + `ResizeHandle`; renders `ExplorerView` (lazy FS tree, hides `.claude` unless enabled) or `SourceControl` |
| `EditorArea` | Tab strip + split button; editor host: single `EditorPane`, split (two panes + divider + file dropdown), or `MarkdownPreview`; renders `TerminalPanel` |
| `EditorPane` | One CodeMirror instance for a file id |
| `MarkdownPreview` | markdown-it render with `.md-body` styling |
| `ClaudePanel` / `TerminalPanel` / `XtermView` | See §11 |
| `SettingsPanel` | Modal with left **icon nav** (Appearance, Typography, Editor, Claude Code, Account Sync) + content per section |
| `SetupWizard` | First-run wizard: Welcome → Sign in (GitHub + Anode-account placeholder) → Projects (+icons) → Appearance → All set. Dismisses permanently on finish/skip |
| `ResizeHandle` | Draggable divider; `axis` "x"/"y", `dir` ±1, `side` left/right/top/bottom |
| `FileLabel` | Splits name into base + extension; base gets the ellipsis, extension stays visible |
| `Icon` | `<Icon name size strokeWidth className />`; all glyphs are 24×24 currentColor strokes |

### Icon names (`IconName` in `Icon.tsx`)
`folder, folderOpen, file, markdown, code, git, pull, push, settings, sparkles,
preview, search, plus, close, chevron, minimize, maximize, send, warning, error,
check, files, github, sync, commit, logout, save, terminal, split, palette,
type, sliders`.

---

## 14. Keyboard shortcuts

Global (handled in `App.tsx`, Ctrl on Win/Linux, Cmd on macOS):

| Shortcut | Action |
| -------- | ------ |
| `Ctrl+S` | Save focused file (writes via `fs.writeFile`; clears dirty) |
| `Ctrl+W` | Close active tab |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+\`` | Toggle integrated terminal |
| `Ctrl+J` | Toggle Claude panel |
| `Ctrl+,` | Open Settings |
| `Ctrl+\` | Toggle split editor |

Within the editor: standard CodeMirror keymaps (undo/redo/find/etc.). The Edit
menu routes Undo/Redo/Find to the focused pane via `lib/actions.editor`.

Save only writes files with a real path (`/[\\/]/.test(path)`); the seed
project's pathless state has nothing to write.

---

## 15. Cross-platform notes

- **Build on the target OS** — Tauri does not cross-compile. Output:
  `src-tauri/target/release/bundle/`.
- **Windows:** acrylic blur + DWM rounded corners; NSIS + MSI installers. The
  public download is `Anode.exe` (rename the NSIS setup exe). Unsigned →
  SmartScreen "Run anyway".
- **macOS:** blur disabled (solid surfaces); `.dmg` + `.app`. Unsigned builds
  need the right-click→Open or `xattr -cr /Applications/Anode.app` workaround
  (signing requires the paid Apple Developer program — intentionally not used).
- **Linux:** blur disabled; `.deb`/`.AppImage`/`.rpm`. Needs `webkit2gtk-4.1` +
  GTK dev libs to build, and a compositor for the transparent rounded corners.
- Platform-specific Rust is `#[cfg(target_os = "...")]` gated. **Code in a
  non-host cfg branch is not compiled by `cargo check` on Windows — write it
  carefully; it's only validated when built on that OS.**
- `claude` and `git` must be on `PATH`; Claude inherits your existing CLI login.

---

## 16. Build & release

`tauri.conf.json` holds `version` (currently `1.3.2`), `productName` ("Anode"),
`identifier`, the frameless/transparent/centered window, and bundle metadata
(`targets: "all"`, `publisher`/`copyright`, icon list incl. `.icns`/`.ico`).
Bump the version in **all three**: `tauri.conf.json`, `package.json`,
`Cargo.toml`.

```bash
npm run app:build      # build installers for the current OS
npm run tauri -- icon path/to/1024.png   # after changing the logo
```

The README has the full per-OS build + install guide. For multi-OS releases, use
GitHub Actions with `tauri-apps/tauri-action` (sample workflow not committed;
documented in README history).

---

## 17. Code conventions

- **Comments explain *why / constraints*, not *what*.** Match the surrounding
  density. Reference files as `path:line`.
- **TypeScript is strict** (`noUnusedLocals`, `noUnusedParameters`,
  `noImplicitAny`). Keep imports used.
- **Components are function components**; state via `useStore(selector)` to
  minimize re-renders. App-level actions live in `lib/actions.ts`, not in
  components, when they're reused or run outside React (e.g. keybindings call
  `useStore.getState()`).
- **No hardcoded colors** — use CSS variables. New surfaces use `--surface*`.
- **Rust commands return `Result<T, String>`** (error as a string surfaced to the
  UI), and structs that cross the boundary derive `Serialize` with snake_case
  fields mirrored in `lib/tauri.ts`.

---

## 18. Recipes (how to add things)

### Add a setting
1. Add the field to `Settings` and `DEFAULT_SETTINGS` in `store.ts` (the persist
   `merge` auto-fills it for existing users — no migration needed).
2. Add a control to the relevant `SettingsPanel` section via
   `set("key", value)`.
3. Consume it where needed via `useStore(s => s.settings.key)`. If it affects
   appearance, handle it in `syncAppearance`.

### Add a theme
Append a `{ id, name, vars }` object to `THEMES` in `themes.ts`. It appears
automatically in the Settings theme grid and the SetupWizard.

### Add a Rust command
1. Write `#[tauri::command] fn my_cmd(...) -> Result<T, String>` in `lib.rs`.
2. Register it in `tauri::generate_handler![...]`.
3. Add a typed wrapper in `lib/tauri.ts` (mirror struct fields exactly).
4. If it needs a new permission, add it to `capabilities/default.json`.
5. `cd src-tauri && cargo check`.

### Add an icon
1. Add the name to the `IconName` union in `Icon.tsx`.
2. Add the SVG `<path>` (24×24, `currentColor`, stroke) to `PATHS`.

### Add a menu item / keybinding
- Menu: add an entry to the relevant menu array in `MenuBar.tsx` (`{label,
  shortcut?, run}`).
- Keybinding: add a `case` to the `keydown` switch in `App.tsx` (and ideally
  reflect it in the menu's `shortcut`).

### Add an editor language
Add a case to `languageFor()` and `languageName()` in `setup.ts` and the
matching `@codemirror/lang-*` dependency.

---

## 19. Gotchas / known limitations

- **Blur ⇄ exact colors are mutually exclusive** in the same region (acrylic
  shows the desktop through). Turn blur off for pixel-exact backgrounds.
- **Diagnostics are a demo linter**, not a language server. The TitleBar counts
  duplicate its rules.
- **Split panes editing the same file** don't live-sync between the two
  CodeMirror instances (separate docs); the store is the source of truth on
  change.
- **Switching projects restarts** the Claude session and the terminal (they're
  `cwd`-bound).
- **GitHub sign-in needs network** and the baked-in client ID; push/pull also
  work via the system credential manager without signing in.
- The persisted store can hold stale shape after big refactors — bump
  `version` and extend `migrate` when removing/renaming top-level fields.

---

## 20. Sync server (`server/`)

A separate, self-hosted backend (its own Cargo project — **not** part of the
Tauri workspace) for accounts + settings sync, plus the `gheat.net/anode`
landing page.

- **Stack:** Rust + **axum** + **SQLite** (`rusqlite`, bundled). Argon2id
  password hashing; random session tokens stored as SHA-256 hashes.
- **`server/src/main.rs`** — the whole API:
  `POST /api/auth/signup|login|logout`, `GET /api/me`,
  `GET|PUT /api/settings` (the settings blob), `GET /api/health`. Auth via
  `Authorization: Bearer <token>`. CORS permissive (safe: header token, not
  cookies). Config: `ANODE_BIND` (default `127.0.0.1:8787`), `ANODE_DB`.
- **`server/web/index.html`** — standalone landing page (Anode aesthetic;
  download button points to `/anode/Anode.exe`).
- **`server/Caddyfile`** — `gheat.net/anode` → static site, `gheat.net/anode/api/*`
  → the server (strips only `/anode` so the server still sees `/api/...`).
- **`server/anode-sync.service`** — systemd unit (runs as user `anode`,
  `/srv/anode`). `server/README.md` has the full Arch deploy + Cloudflare TLS
  guide.

**Frontend client:** `src/lib/account.ts` (base URL `https://gheat.net/anode/api`,
override with `VITE_ANODE_API`; token in `localStorage` key
`anode-account-token`). UI: `src/components/AccountSync.tsx`, shown in
**Settings → Account Sync**. Sign in/up, then **Sync to cloud** (PUT the settings
blob) / **Restore from cloud** (GET + apply each key). First sign-in pulls cloud
settings if present, else pushes local. The clipboard export/import remains as a
no-account manual backup.
```
