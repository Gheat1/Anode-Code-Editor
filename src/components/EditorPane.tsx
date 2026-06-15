import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseExtensions, languageFor } from "../editor/setup";
import { smoothCaret } from "../editor/smoothCaret";
import { demoLinter } from "../editor/linter";
import { useStore } from "../state/store";

// One CodeMirror instance, recreated when the active file changes. Content
// edits flow back into the store so tabs, dirty state, and preview stay in sync.
export function EditorPane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const activeFileId = useStore((s) => s.activeFileId);
  const file = useStore((s) =>
    s.openFiles.find((f) => f.id === s.activeFileId)
  );
  const updateFileContent = useStore((s) => s.updateFileContent);
  const smoothCaretOn = useStore((s) => s.settings.smoothCaret);
  const lineNumbersOn = useStore((s) => s.settings.lineNumbers);

  // Compartments let us reconfigure caret / line numbers without rebuilding.
  const caretComp = useRef(new Compartment());

  useEffect(() => {
    if (!hostRef.current || !file) return;

    const state = EditorState.create({
      doc: file.content,
      extensions: [
        baseExtensions({ lineNumbers: lineNumbersOn }),
        languageFor(file.name),
        demoLinter,
        caretComp.current.of(smoothCaretOn ? smoothCaret : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            updateFileContent(file.id, u.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    view.dom.classList.toggle("no-smooth-caret", !smoothCaretOn);
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate when the file identity or structural settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId, lineNumbersOn]);

  // Toggle the smooth caret live without rebuilding the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: caretComp.current.reconfigure(smoothCaretOn ? smoothCaret : []),
    });
    view.dom.classList.toggle("no-smooth-caret", !smoothCaretOn);
  }, [smoothCaretOn]);

  if (!file) return null;
  return <div className="cm-wrap" ref={hostRef} />;
}
