import { Icon } from "./Icon";
import { FileLabel } from "./FileLabel";
import { EditorPane } from "./EditorPane";
import { MarkdownPreview } from "./MarkdownPreview";
import { TerminalPanel } from "./TerminalPanel";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../state/store";
import { openFolderAsProject } from "../lib/actions";

export function EditorArea() {
  const openFiles = useStore((s) => s.openFiles);
  const activeFileId = useStore((s) => s.activeFileId);
  const setActiveFile = useStore((s) => s.setActiveFile);
  const closeFile = useStore((s) => s.closeFile);
  const showPreview = useStore((s) => s.showPreview);
  const showTerminal = useStore((s) => s.showTerminal);
  const splitView = useStore((s) => s.splitView);
  const splitFileId = useStore((s) => s.splitFileId);
  const setSplitFile = useStore((s) => s.setSplitFile);
  const splitWidth = useStore((s) => s.splitWidth);
  const setSplitWidth = useStore((s) => s.setSplitWidth);
  const toggle = useStore((s) => s.toggle);

  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const isMarkdown = activeFile?.name.endsWith(".md");
  const rightId = splitFileId ?? activeFileId;

  return (
    <section className="editor-area">
      {openFiles.length === 0 ? (
        <div className="empty">
          <div className="inner">
            <Icon name="code" size={40} />
            <div>No file open</div>
            <div style={{ fontSize: 13 }}>
              <button style={{ color: "var(--accent)" }} onClick={openFolderAsProject}>
                Open a folder
              </button>{" "}
              or pick a file from the explorer.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="tabs">
            <div className="tab-strip">
              {openFiles.map((f) => (
                <div
                  key={f.id}
                  className={`tab ${f.id === activeFileId ? "active" : ""}`}
                  onClick={() => setActiveFile(f.id)}
                >
                  <Icon name={f.name.endsWith(".md") ? "markdown" : "code"} size={14} />
                  <FileLabel name={f.name} />
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
            <button
              className={`tab-action ${splitView ? "active" : ""}`}
              title="Split editor"
              onClick={() => toggle("splitView")}
            >
              <Icon name="split" size={16} />
            </button>
          </div>

          {isMarkdown && showPreview ? (
            <div className="editor-host">
              <MarkdownPreview />
            </div>
          ) : splitView ? (
            <div className="editor-host split">
              <div className="split-pane" style={{ width: splitWidth }}>
                <EditorPane fileId={activeFileId ?? undefined} />
                <ResizeHandle
                  axis="x"
                  side="right"
                  value={splitWidth}
                  min={260}
                  max={1100}
                  dir={1}
                  onChange={setSplitWidth}
                />
              </div>
              <div className="split-pane grow">
                <div className="split-head">
                  <select
                    value={rightId ?? ""}
                    onChange={(e) => setSplitFile(e.target.value)}
                  >
                    {openFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="split-close"
                    title="Close split"
                    onClick={() => toggle("splitView")}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
                {rightId && <EditorPane fileId={rightId} />}
              </div>
            </div>
          ) : (
            <div className="editor-host">
              <EditorPane />
            </div>
          )}
        </>
      )}

      {showTerminal && <TerminalPanel />}
    </section>
  );
}
