import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import taskLists from "markdown-it-task-lists";
import { useStore } from "../state/store";

// A clean, Obsidian-flavored renderer: GFM tables, task lists, autolinked
// headings, and code fences. Styling lives in .md-body (global.css).
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
})
  .use(anchor, { permalink: false })
  .use(taskLists, { enabled: true, label: true });

export function MarkdownPreview() {
  const file = useStore((s) => s.openFiles.find((f) => f.id === s.activeFileId));
  const html = useMemo(
    () => (file ? md.render(file.content) : ""),
    [file?.content]
  );

  return (
    <div className="md-preview">
      <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
