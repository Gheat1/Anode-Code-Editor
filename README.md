# Anode

A Claude-native code editor for Windows, built from scratch — **not** on VS Code.

- **Shell:** Tauri 2 (Rust core + WebView2) — small, fast, native Windows acrylic blur
- **UI:** React 19 + TypeScript + Vite
- **Editor:** CodeMirror 6 with a custom smooth animated caret
- **AI:** the real **Claude Code** CLI, run in a PTY and rendered with xterm.js — no API key

## Prerequisites

- Node 20+ and Rust (stable) — both already detected on this machine
- **Claude Code** installed and on your PATH (`claude` runs from a terminal) —
  the right panel launches it directly, so you're signed in exactly as you are
  in your normal terminal
- **Microsoft Edge WebView2 runtime** (ships with Windows 11; no action needed)
- For the desktop build: the MSVC C++ build tools (`rustup` + Visual Studio Build Tools)

## Run it

```powershell
npm install          # once
npm run app          # launches the desktop app (compiles Rust the first time)
```

`npm run app` runs `tauri dev`: it starts Vite on :1420 and boots the native
window. The first launch compiles the Rust crates and takes a few minutes;
after that it's instant with hot-reload on the frontend.

Frontend-only preview (no native features — Claude/git/blur are stubbed):

```powershell
npm run dev          # open http://localhost:1420 in a browser
```

## Build for your own OS

Tauri does **not** cross-compile — build on the OS you want to run on. Every
build is the same two steps; output lands in `src-tauri/target/release/bundle/`.

```bash
npm install
npm run app:build      # = tauri build
```

The version comes from `src-tauri/tauri.conf.json` → `"version"` (currently
`1.3.3`); bump it there plus `package.json` and `Cargo.toml` for each release.

### Windows
**Prereqs:** Rust, the MSVC C++ Build Tools, Node. WebView2 ships with Windows 11.

```powershell
npm run app:build
```
Produces `nsis/Anode_1.3.3_x64-setup.exe` (and an `.msi`). The official Windows
download is the release **`Anode.exe`** — rename the setup exe and attach it to
the GitHub Release. First run shows a SmartScreen "unknown publisher" prompt
(unsigned) → **More info → Run anyway**.

### Linux
**Prereqs:**
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  libssl-dev build-essential curl
# + Rust (rustup) and Node 20
```
```bash
npm run app:build
```
Produces `deb/*.deb`, `appimage/*.AppImage`, and `rpm/*.rpm`. The AppImage is
portable: `chmod +x Anode_1.3.3_amd64.AppImage && ./Anode_1.3.3_amd64.AppImage`.
A compositor is needed for the transparent rounded corners (standard on
GNOME/KDE).

### macOS
**Prereqs:** Rust, Xcode Command Line Tools (`xcode-select --install`), Node.

```bash
npm run app:build
```
Produces `dmg/Anode_1.3.3_aarch64.dmg` and `macos/Anode.app`.

> **No Apple Developer account?** That's fine — the build just isn't signed or
> notarized, so macOS Gatekeeper warns on first open. See **Installing on macOS**
> below for how to get past it. (Signing requires the $99/yr Apple program; it's
> only needed to ship a "just works" double-click install to other people.)

## Installing

### Windows
Download `Anode.exe` from Releases and run it. On the SmartScreen prompt choose
**More info → Run anyway** (it's unsigned, not unsafe).

### macOS (unsigned build)
Because the app isn't notarized, macOS blocks it on first launch. Get past it one
of these ways:

- **Right-click method:** right-click `Anode.app` → **Open** → **Open** in the
  dialog. (Only needed once.)
- **Or strip the quarantine flag** in Terminal:
  ```bash
  xattr -cr /Applications/Anode.app
  ```
  Then open it normally. If you see *"Anode is damaged"*, that's the same
  quarantine issue — the `xattr -cr` command fixes it.

### Linux
Install the `.deb`/`.rpm` with your package manager, or just run the `.AppImage`
directly.

### Cross-platform notes
- The acrylic **blur is Windows-only**; macOS/Linux use solid (exact) surfaces.
- Regenerate icons after changing the logo: `npm run tauri -- icon path/to/1024.png`.

## Where things live

```
src/
  App.tsx                 # app shell + layout
  state/store.ts          # zustand store: settings + workspace (the sync blob)
  styles/
    themes.ts             # theme presets + palette-from-accent generator
    global.css            # all styling, driven by CSS variables
  editor/
    setup.ts              # CodeMirror extensions, languages, syntax theme
    smoothCaret.ts        # the animated caret (ViewPlugin)
    linter.ts             # demo diagnostics → error/warning highlights
  components/
    TitleBar / ActivityBar / Sidebar / EditorArea / EditorPane
    MarkdownPreview       # Obsidian-style render (markdown-it)
    ClaudePanel           # the real Claude Code CLI in an xterm.js terminal
    SettingsPanel         # themes, palette, fonts, blur, sync
    ResizeHandle.tsx      # draggable dividers for the side panels
    Icon.tsx              # monochrome currentColor icon pack
  lib/tauri.ts            # typed wrappers around Rust commands
src-tauri/
  src/lib.rs              # blur, fs read/write, git, Claude Code PTY
  tauri.conf.json         # frameless transparent window config
```

## Feature map (what's wired vs. stubbed)

| Feature                         | Status | Notes |
| ------------------------------- | ------ | ----- |
| Themes + palette chooser        | ✅     | CSS-variable based, fully consistent |
| Global fonts                    | ✅     | Interface + editor font, base size |
| Blurred background              | ✅     | Windows acrylic via `window-vibrancy` |
| Smooth caret                    | ✅     | Custom CodeMirror ViewPlugin |
| Monochrome icons                | ✅     | `currentColor` SVGs, recolor with theme |
| Markdown preview                | ✅     | markdown-it + tasks/anchors |
| Line numbers + diagnostics      | ✅     | demo linter; swap for an LSP |
| Project switcher (no reload)    | ✅     | activity-bar rail, state-only switch |
| Add repo / folder               | ✅     | `+` opens the native folder picker, loads the real tree |
| Resizable + closable panels     | ✅     | drag the edges; close Claude via the panel's ✕ or the rail |
| Claude embedded                 | ✅     | the real `claude` CLI in a PTY — no API key |
| GitHub push/pull                | ✅\*   | shells to system `git`; uses the picked folder's path |
| Settings sync                   | 🔌     | local + export/import; point at your backend |

\* Git commands run against the active project's folder. The seeded demo
project has no path; add a real one with the `+` button.

## GitHub sign-in

The Source Control panel (git icon in the left rail) auto-detects whether git is
installed and whether the open folder is a repo — offering **Initialize
Repository**, a commit box, and a **Sync** button as appropriate.

"Sign in with GitHub" uses the OAuth **device flow** and works out of the box —
Anode's OAuth app client ID is built in (client IDs are public; only the client
*secret* is sensitive, and the device flow doesn't use one). Click sign in,
enter the shown code on github.com, and you're connected.

To point Anode at a different OAuth app, override the client ID:
```powershell
$env:ANODE_GITHUB_CLIENT_ID = "Ov23xxxxxxxx"; npm run app
```

Either way, **push/pull also work** through Windows' Git Credential Manager,
which prompts a browser login on first use. If you already use the `gh` CLI and
are signed in there, Anode shows that identity automatically.

## Next steps

1. **Save on edit** — wire the editor's dirty buffer to `fs.writeFile` (already
   exposed) on Ctrl+S so edits persist to disk.
2. **Real diagnostics** — drop `linter.ts` and connect a language server via
   `tower-lsp` on the Rust side, surfacing results through `@codemirror/lint`.
3. **Persist the Claude session** — today toggling the panel restarts `claude`
   in the active folder. Keep the PTY alive across toggles (don't `claude_kill`
   on unmount) if you want the conversation to survive hiding the panel.
4. **Settings sync backend** — the entire `Settings` object is one JSON blob;
   wire `exportSettings`/`importSettings` in `SettingsPanel.tsx` to
   `POST/GET /settings` behind your auth.
5. **GitHub OAuth** — for clone-by-URL and private repos, add a device-flow
   login; push/pull already reuse the Windows credential manager.
