import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { baseExtensions, languageFor } from "../editor/setup";
import { smoothCaret } from "../editor/smoothCaret";
import { demoLinter } from "../editor/linter";
import { setActiveView, getActiveView } from "../editor/activeView";
import { useStore } from "../state/store";

// One CodeMirror instance bound to a specific file. With no `fileId` it follows
// the global active file; in split view each pane is given an explicit id.
export function EditorPane({ fileId }: { fileId?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const activeFileId = useStore((s) => s.activeFileId);
  const id = fileId ?? activeFileId;
  const file = useStore((s) => s.openFiles.find((f) => f.id === id));
  const updateFileContent = useStore((s) => s.updateFileContent);
  const smoothCaretOn = useStore((s) => s.settings.smoothCaret);
  const lineNumbersOn = useStore((s) => s.settings.lineNumbers);

  const caretComp = useRef(new Compartment());

  useEffect(() => {
    if (!hostRef.current || !file) return;
    const fid = file.id;
    // Big files: skip the per-keystroke linter to keep typing responsive.
    const big = file.content.length > 200_000;

    const state = EditorState.create({
      doc: file.content,
      extensions: [
        baseExtensions({ lineNumbers: lineNumbersOn }),
        languageFor(file.name),
        ...(big ? [] : [demoLinter]),
        caretComp.current.of(smoothCaretOn ? smoothCaret : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) updateFileContent(fid, u.state.doc.toString());
          if (u.focusChanged && u.view.hasFocus) setActiveView(u.view, fid);
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    view.dom.classList.toggle("no-smooth-caret", !smoothCaretOn);
    viewRef.current = view;
    setActiveView(view, fid);
    view.focus();

    return () => {
      if (getActiveView() === view) setActiveView(null);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lineNumbersOn]);

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
