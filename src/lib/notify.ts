import { inTauri } from "./tauri";

// Thin wrapper over the Tauri notification plugin. Permission is requested once,
// lazily, the first time we try to notify; everything no-ops gracefully outside
// the desktop app or if permission is denied.
let asked = false;
let granted = false;

async function ensurePermission(): Promise<boolean> {
  if (!inTauri) return false;
  if (asked) return granted;
  asked = true;
  try {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
  } catch {
    granted = false;
  }
  return granted;
}

export async function notify(title: string, body?: string): Promise<void> {
  if (!(await ensurePermission())) return;
  try {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({ title, body });
  } catch {
    /* plugin missing / denied — ignore */
  }
}
