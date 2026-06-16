import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

// Inline color swatches. Any hex color literal in the document (#rgb, #rgba,
// #rrggbb, #rrggbbaa) gets a small clickable chip rendered just before it;
// clicking opens the OS color wheel and writes the chosen hex back into the
// file. Scans only the visible viewport, so it's cheap even in large files.
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

// <input type="color"> only accepts #rrggbb. Expand shorthand and drop any
// alpha nibble(s) so the picker opens on the right hue.
function toPickerValue(hex: string): string {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  else if (h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6);
  return "#" + h.toLowerCase();
}

class SwatchWidget extends WidgetType {
  constructor(
    readonly color: string,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: SwatchWidget) {
    return (
      other.color === this.color &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView) {
    const chip = document.createElement("span");
    chip.className = "cm-color-swatch";
    chip.style.backgroundColor = this.color;
    chip.title = "Pick color";

    chip.onmousedown = (e) => {
      e.preventDefault(); // keep editor focus/selection
      const input = document.createElement("input");
      input.type = "color";
      input.value = toPickerValue(this.color);
      // Park the (invisible) native input at the click point so the OS picker
      // pops up near the swatch.
      input.style.cssText =
        "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;" +
        `left:${e.clientX}px;top:${e.clientY}px;`;
      document.body.appendChild(input);

      // Commit once, on close/commit (`change`). Doing it per `input` event
      // while dragging would shift the doc and invalidate our stored range.
      const commit = () => {
        if (input.value && input.value !== this.color) {
          view.dispatch({
            changes: { from: this.from, to: this.to, insert: input.value },
          });
        }
        input.remove();
      };
      input.addEventListener("change", commit);
      input.addEventListener("blur", () => input.remove());
      input.click();
    };

    return chip;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const widgets: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    HEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = HEX.exec(text))) {
      const start = from + m.index;
      const end = start + m[0].length;
      widgets.push(
        Decoration.widget({
          widget: new SwatchWidget(m[0], start, end),
          side: -1,
        }).range(start)
      );
    }
  }
  return Decoration.set(widgets, true);
}

export const inlineColorPicker = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
