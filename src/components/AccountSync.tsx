import { useState } from "react";
import { Icon } from "./Icon";
import { account } from "../lib/account";
import { useStore, DEFAULT_SETTINGS, Settings } from "../state/store";

// Cloud account + settings sync, backed by the self-hosted server (server/).
export function AccountSync() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const email = useStore((s) => s.accountEmail); // signed-in identity (shared)
  const setEmail = useStore((s) => s.setAccountEmail);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const e =
        mode === "signup"
          ? await account.signup(form.email, form.password)
          : await account.login(form.email, form.password);
      setEmail(e);
      setForm({ email: "", password: "" });
      // First sign-in: pull cloud settings if any, else push the local ones.
      const cloud = await account.pullSettings();
      if (cloud) applySettings(cloud);
      else await account.pushSettings(settings);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  function applySettings(data: unknown) {
    const parsed = data as Partial<Settings>;
    (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).forEach((k) =>
      setSetting(k, (parsed[k] ?? DEFAULT_SETTINGS[k]) as never)
    );
  }

  async function push() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      await account.pushSettings(settings);
      setStatus("Settings synced to the cloud.");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function pull() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const cloud = await account.pullSettings();
      if (cloud) {
        applySettings(cloud);
        setStatus("Settings restored from the cloud.");
      } else {
        setStatus("Nothing saved in the cloud yet.");
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await account.logout();
    setEmail(null);
  }

  if (email) {
    return (
      <div className="acct">
        <div className="acct-id">
          <span className="acct-avatar">{email[0]?.toUpperCase()}</span>
          <div>
            <div className="acct-email">{email}</div>
            <div className="acct-sub">Signed in · settings sync enabled</div>
          </div>
          <span style={{ flex: 1 }} />
          <button className="scm-icon" title="Sign out" onClick={signOut}>
            <Icon name="logout" size={14} />
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="done" disabled={busy} onClick={push}>
            <Icon name="sync" size={14} /> Sync to cloud
          </button>
          <button
            className="done"
            style={{ background: "var(--bg-active)" }}
            disabled={busy}
            onClick={pull}
          >
            Restore from cloud
          </button>
        </div>
        {status && <div className="acct-status">{status}</div>}
        {error && <div className="scm-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="acct">
      <div className="acct-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
      </div>
      <input
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="password"
        placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button className="done full" disabled={busy} onClick={submit}>
        {busy ? "…" : mode === "signup" ? "Create account & sync" : "Sign in"}
      </button>
      {error && <div className="scm-error">{error}</div>}
    </div>
  );
}
