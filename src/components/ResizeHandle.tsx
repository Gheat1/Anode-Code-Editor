// A draggable divider. axis "x" = vertical bar (resizes width), axis "y" =
// horizontal bar (resizes height). `dir` is +1 when the panel grows as you drag
// in the positive axis direction, -1 when it grows as you drag back.
export function ResizeHandle({
  axis = "x",
  side,
  value,
  min,
  max,
  dir,
  onChange,
}: {
  axis?: "x" | "y";
  side: "left" | "right" | "top" | "bottom";
  value: number;
  min: number;
  max: number;
  dir: 1 | -1;
  onChange: (next: number) => void;
}) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const start = axis === "x" ? e.clientX : e.clientY;
    const startVal = value;
    const move = (ev: MouseEvent) => {
      const pos = axis === "x" ? ev.clientX : ev.clientY;
      const next = startVal + dir * (pos - start);
      onChange(Math.max(min, Math.min(max, next)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return <div className={`resizer ${side}`} onMouseDown={onMouseDown} />;
}
