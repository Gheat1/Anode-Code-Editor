import { OpenFile } from "../state/store";

// Seed files so the editor and preview have something to show on first launch.
export const WELCOME_FILES: Record<string, OpenFile> = {
  "welcome.md": {
    id: "welcome.md",
    name: "welcome.md",
    path: "welcome.md",
    language: "Markdown",
    dirty: false,
    content: `# Welcome to Anode

A **Claude-native** code editor — built from scratch, not on VS Code.

## Try it

- Toggle the **preview** with the eye icon (this file renders Obsidian-style).
- Open **Settings** (gear, bottom-left) to switch themes, pick a custom palette,
  change the global font, or turn the blurred background on and off.
- Ask **Claude** anything in the right panel — it can see the file you're editing.

> The caret glides instead of jumping. Click around and watch it.

## Checklist

- [x] Smooth animated caret
- [x] Monochrome icon pack
- [ ] Wire up your GitHub repos
- [ ] Sign in to sync settings

| Feature        | Status |
| -------------- | ------ |
| Themes         | ✅     |
| Blur           | ✅     |
| Git push/pull  | 🔌     |

\`\`\`ts
// console.log lights up as an error from the demo linter
function greet(name: string) {
  console.log("hi", name);   // <- try removing this
  return \`Hello, \${name}\`;
}
\`\`\`
`,
  },
  "scratch.ts": {
    id: "scratch.ts",
    name: "scratch.ts",
    path: "scratch.ts",
    language: "TypeScript",
    dirty: false,
    content: `// A scratchpad to feel out the editor.
// TODO: hook this up to a real language server for full diagnostics.

type Theme = "midnight" | "obsidian" | "nord";

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  console.log("applied", theme); // demo linter flags this line
}

applyTheme("midnight");
`,
  },
};
