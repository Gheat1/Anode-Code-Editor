import { Icon } from "./Icon";
import { EditorPane } from "./EditorPane";
import { MarkdownPreview } from "./MarkdownPreview";
import { useStore } from "../state/store";
import { WELCOME_FILES } from "../data/welcome";

export function EditorArea() {
  const openFiles = useStore((s) => s.openFiles);
  const activeFileId = useStore((s) => s.activeFileId);
  const setActiveFile = useStore((s) => s.setActiveFile);
  const closeFile = useStore((s) => s.closeFile);
  const openFile = useStore((s) => s.openFile);
  const showPreview = useStore((s) => s.showPreview);

  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const isMarkdown = activeFile?.name.endsWith(".md");

  if (openFiles.length === 0) {
    return (
      <section className="editor-area">
        <div className="empty">
          <div className="inner">
            <Icon name="code" size={40} />
            <div>No file open</div>
            <div style={{ fontSize: 13 }}>
              <button
                style={{ color: "var(--accent)" }}
                onClick={() => openFile(WELCOME_FILES["welcome.md"])}
              >
                Open welcome.md
              </button>{" "}
              or pick a file from the explorer.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="editor-area">
      <div className="tabs">
        {openFiles.map((f) => (
          <div
            key={f.id}
            className={`tab ${f.id === activeFileId ? "active" : ""}`}
            onClick={() => setActiveFile(f.id)}
          >
            <Icon name={f.name.endsWith(".md") ? "markdown" : "code"} size={14} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {f.name}
            </span>
            {f.dirty ? (
              <span className="dot" />
            ) : (
              <span
                className="close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(f.id);
                }}
              >
                <Icon name="close" size={13} />
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="editor-host">
        {isMarkdown && showPreview ? <MarkdownPreview /> : <EditorPane />}
      </div>
    </section>
  );
}
