// Renders a filename that truncates in the middle, keeping the extension
// visible: a narrow "component.tsx" becomes "compon….tsx" instead of losing
// the ".tsx". The base shrinks with a CSS ellipsis; the extension never shrinks.
export function FileLabel({ name }: { name: string }) {
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0 && dot < name.length - 1;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : "";
  return (
    <span className="fname">
      <span className="fname-base">{base}</span>
      {ext && <span className="fname-ext">{ext}</span>}
    </span>
  );
}
