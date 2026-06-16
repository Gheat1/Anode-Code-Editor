import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// A custom caret that glides to its new position with a CSS transition instead
// of jumping. The native caret is hidden via CSS (caret-color: transparent).
//
// Perf: the position read (coordsAtPos / getBoundingClientRect) goes through
// CodeMirror's requestMeasure so it runs in the batched measure phase instead of
// forcing a synchronous layout on every update — important because geometry
// changes fire on every scroll frame. While scrolling we also drop the CSS
// transition so the caret snaps with the content rather than laggily chasing it.
class SmoothCaretPlugin {
  caret: HTMLDivElement;
  blinkTimer: number | undefined;
  scheduled = false;

  constructor(readonly view: EditorView) {
    this.caret = document.createElement("div");
    this.caret.className = "smooth-caret blink";
    view.dom.appendChild(this.caret);
    this.schedule();
  }

  update(u: ViewUpdate) {
    if (!(u.docChanged || u.selectionSet || u.geometryChanged || u.focusChanged)) return;
    const scrolling = u.geometryChanged && !u.docChanged && !u.selectionSet;
    this.caret.classList.toggle("no-anim", scrolling);
    this.schedule();
    if (!scrolling) {
      this.caret.classList.remove("blink");
      window.clearTimeout(this.blinkTimer);
      this.blinkTimer = window.setTimeout(() => this.caret.classList.add("blink"), 500);
    }
  }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    this.view.requestMeasure({
      read: (view) => {
        const head = view.state.selection.main.head;
        return {
          coords: view.coordsAtPos(head),
          rect: view.dom.getBoundingClientRect(),
          focus: view.hasFocus,
        };
      },
      write: (m) => {
        this.scheduled = false;
        if (!m.coords || !m.focus) {
          this.caret.style.opacity = "0";
          return;
        }
        this.caret.style.opacity = "1";
        this.caret.style.height = `${m.coords.bottom - m.coords.top}px`;
        this.caret.style.transform = `translate(${m.coords.left - m.rect.left}px, ${
          m.coords.top - m.rect.top
        }px)`;
      },
    });
  }

  destroy() {
    window.clearTimeout(this.blinkTimer);
    this.caret.remove();
  }
}

export const smoothCaret = ViewPlugin.fromClass(SmoothCaretPlugin);
