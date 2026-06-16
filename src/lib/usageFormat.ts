// Shared formatting for Claude usage figures (used by the panel meter and the
// detailed Settings view).

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
}

// claude-sonnet-4-6 -> "Sonnet 4.6", claude-opus-4-8 -> "Opus 4.8"
export function shortModel(model: string): string {
  const m = model.toLowerCase();
  const fam = m.includes("opus")
    ? "Opus"
    : m.includes("haiku")
    ? "Haiku"
    : m.includes("sonnet")
    ? "Sonnet"
    : "";
  const ver = model.match(/(\d+)-(\d+)/);
  if (fam && ver) return `${fam} ${ver[1]}.${ver[2]}`;
  return fam || model.replace(/^claude-/, "");
}
