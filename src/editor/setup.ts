import { Extension } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  keymap,
} from "@codemirror/view";
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { closeBrackets, autocompletion, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { lintKeymap, lintGutter } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";

import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";

// Syntax colors keyed off the theme's accent + text variables so highlighting
// shifts with the active theme. (CodeMirror needs concrete colors here, so we
// pull the computed CSS variable values at construction time.)
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function anodeHighlight(): HighlightStyle {
  const accent = cssVar("--accent", "#7c8cff");
  const text = cssVar("--text", "#e6e6ee");
  const dim = cssVar("--text-dim", "#a0a0b0");
  return HighlightStyle.define([
    { tag: t.keyword, color: accent, fontWeight: "600" },
    { tag: [t.name, t.deleted, t.character, t.macroName], color: text },
    { tag: [t.function(t.variableName), t.labelName], color: "#7fd1c8" },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#e5a36b" },
    { tag: [t.definition(t.name), t.separator], color: text },
    { tag: [t.typeName, t.className, t.number, t.changed], color: "#e5c07b" },
    { tag: [t.operator, t.operatorKeyword], color: dim },
    { tag: [t.string, t.inserted], color: "#98c379" },
    { tag: [t.comment, t.lineComment, t.blockComment], color: dim, fontStyle: "italic" },
    { tag: t.invalid, color: "#ff6b6b" },
    { tag: [t.heading], color: accent, fontWeight: "700" },
    { tag: [t.link, t.url], color: accent, textDecoration: "underline" },
    { tag: [t.emphasis], fontStyle: "italic" },
    { tag: [t.strong], fontWeight: "700" },
  ]);
}

export function languageFor(filename: string): Extension {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return javascript({ jsx: true, typescript: ext.startsWith("ts") });
    case "md":
    case "markdown":
      return markdown();
    case "py":
      return python();
    case "rs":
      return rust();
    case "css":
      return css();
    case "html":
    case "htm":
      return html();
    case "json":
      return json();
    default:
      return [];
  }
}

export function languageName(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "JavaScript React",
    md: "Markdown",
    py: "Python",
    rs: "Rust",
    css: "CSS",
    html: "HTML",
    json: "JSON",
  };
  return map[ext] ?? "Plain Text";
}

// The shared set of editor behaviors: line numbers, fold + lint gutters,
// history, bracketing, search, autocomplete, and our themed highlighting.
export function baseExtensions(opts: { lineNumbers: boolean }): Extension[] {
  return [
    opts.lineNumbers ? lineNumbers() : [],
    highlightActiveLineGutter(),
    foldGutter(),
    lintGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    syntaxHighlighting(anodeHighlight()),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    EditorView.lineWrapping,
  ];
}
