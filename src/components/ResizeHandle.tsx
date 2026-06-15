// A draggable vertical divider. `dir` is +1 when the panel grows as you drag
// right (left sidebar) and -1 when it grows as you drag left (right panel).
export function ResizeHandle({
  side,
  value,
  min,
  max,
  dir,
  onChange,
}: {
  side: "left" | "right";
  value: number;
  min: number;
  max: number;
  dir: 1 | -1;
  onChange: (next: number) => void;
}) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startVal = value;
    const move = (ev: MouseEvent) => {
      const next = startVal + dir * (ev.clientX - startX);
      onChange(Math.max(min, Math.min(max, next)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return <div className={`resizer ${side}`} onMouseDown={onMouseDown} />;
}
