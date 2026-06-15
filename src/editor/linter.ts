import { linter, Diagnostic } from "@codemirror/lint";

// A lightweight demo linter so error/warning highlights are visible out of the
// box. Swap this for a Language Server (via tower-lsp on the Rust side) or a
// worker-based type checker when you wire up real diagnostics.
export const demoLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc;

  for (let i = 1; i <= text.lines; i++) {
    const line = text.line(i);
    const content = line.text;

    // Warning: leftover task markers.
    const todo = content.match(/\b(TODO|FIXME|XXX)\b/);
    if (todo) {
      const at = line.from + (todo.index ?? 0);
      diagnostics.push({
        from: at,
        to: at + todo[0].length,
        severity: "warning",
        message: `Unresolved ${todo[0]} marker`,
      });
    }

    // Error: a stray `console.log` left in committed code (example rule).
    const log = content.match(/console\.log/);
    if (log) {
      const at = line.from + (log.index ?? 0);
      diagnostics.push({
        from: at,
        to: at + "console.log".length,
        severity: "error",
        message: "Remove debug console.log before committing",
      });
    }

    // Warning: trailing whitespace.
    const trail = content.match(/\s+$/);
    if (trail && content.trim().length > 0) {
      diagnostics.push({
        from: line.from + (trail.index ?? 0),
        to: line.to,
        severity: "warning",
        message: "Trailing whitespace",
      });
    }
  }

  return diagnostics;
});
