// Parse the text printed by `claude -p /usage` into the real subscription
// limits. Example output:
//
//   You are currently using your subscription to power your Claude Code usage
//
//   Current session: 8% used · resets Jun 16, 7:09am (America/Los_Angeles)
//   Current week (all models): 13% used · resets Jun 20, 6:59pm (America/Los_Angeles)
//   Current week (Sonnet only): 2% used · resets Jun 20, 7pm (America/Los_Angeles)

export interface LimitEntry {
  key: "session" | "week" | "week_sonnet" | "other";
  label: string;
  percent: number;
  resets: string; // tidied, e.g. "Jun 16, 7:09am"
}

export function parseLimits(text: string): LimitEntry[] {
  const out: LimitEntry[] = [];
  // "Current <name>: <n>% used · resets <when>" — the separator between "used"
  // and "resets" is a middle dot, matched loosely so glyph changes don't break.
  const re = /Current\s+([^:]+):\s*(\d+)%\s*used[^A-Za-z0-9]+resets\s+(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    const percent = Math.max(0, Math.min(100, parseInt(m[2], 10) || 0));
    const resets = m[3].replace(/\s*\([^)]*\)\s*$/, "").trim(); // drop "(timezone)"
    let key: LimitEntry["key"] = "other";
    let label = raw;
    if (/session/i.test(raw)) {
      key = "session";
      label = "5-hour session";
    } else if (/all models/i.test(raw)) {
      key = "week";
      label = "Weekly (all models)";
    } else if (/sonnet/i.test(raw)) {
      key = "week_sonnet";
      label = "Weekly (Sonnet)";
    }
    out.push({ key, label, percent, resets });
  }
  return out;
}
