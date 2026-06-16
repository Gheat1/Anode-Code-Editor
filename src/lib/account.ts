// Client for the Anode sync server (server/). Talks to gheat.net/anode/api by
// default; override with the VITE_ANODE_API env var at build time. The session
// token lives in localStorage; settings are pushed/pulled as one blob.
const API_BASE =
  (import.meta.env.VITE_ANODE_API as string | undefined) ||
  "https://gheat.net/anode/api";
const TOKEN_KEY = "anode-account-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

export const account = {
  isSignedIn: () => !!getToken(),

  async signup(email: string, password: string): Promise<string> {
    const r = await req<{ token: string; email: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(r.token);
    return r.email;
  },

  async login(email: string, password: string): Promise<string> {
    const r = await req<{ token: string; email: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(r.token);
    return r.email;
  },

  async logout(): Promise<void> {
    try {
      await req("/auth/logout", { method: "POST" });
    } catch {
      /* clear locally regardless */
    }
    setToken(null);
  },

  me: () => req<{ email: string }>("/me").then((r) => r.email),

  pushSettings: (data: unknown) =>
    req("/settings", { method: "PUT", body: JSON.stringify({ data }) }),

  pullSettings: () =>
    req<{ data: unknown | null; updated_at: number | null }>("/settings").then(
      (r) => r.data
    ),
};
