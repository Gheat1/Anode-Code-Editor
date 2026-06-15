import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// A custom caret that glides to its new position with a CSS transition instead
// of jumping. The native caret is hidden via CSS (caret-color: transparent);
// this plugin draws and moves a <div> to follow the primary cursor.
class SmoothCaretPlugin {
  caret: HTMLDivElement;
  blinkTimer: number | undefined;

  constructor(readonly view: EditorView) {
    this.caret = document.createElement("div");
    this.caret.className = "smooth-caret blink";
    view.dom.appendChild(this.caret);
    this.measure();
  }

  update(u: ViewUpdate) {
    if (u.docChanged || u.selectionSet || u.geometryChanged || u.focusChanged) {
      this.measure();
      // Restart the blink so the caret is solid while you're actively moving.
      this.caret.classList.remove("blink");
      window.clearTimeout(this.blinkTimer);
      this.blinkTimer = window.setTimeout(
        () => this.caret.classList.add("blink"),
        500
      );
    }
  }

  measure() {
    const { view } = this;
    const head = view.state.selection.main.head;
    const coords = view.coordsAtPos(head);
    if (!coords || !view.hasFocus) {
      this.caret.style.opacity = "0";
      return;
    }
    this.caret.style.opacity = "1";
    const editorRect = view.dom.getBoundingClientRect();
    const x = coords.left - editorRect.left;
    const y = coords.top - editorRect.top;
    const h = coords.bottom - coords.top;
    this.caret.style.height = `${h}px`;
    this.caret.style.transform = `translate(${x}px, ${y}px)`;
  }

  destroy() {
    window.clearTimeout(this.blinkTimer);
    this.caret.remove();
  }
}

export const smoothCaret = ViewPlugin.fromClass(SmoothCaretPlugin);
