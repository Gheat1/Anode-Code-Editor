use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, Window};

// ---------------------------------------------------------------------------
// Rounded window corners (Windows 11). The window is frameless + transparent,
// so Win11 won't round it automatically — we opt in via DWM so the acrylic
// backdrop is clipped to the rounded shape.
// ---------------------------------------------------------------------------
#[cfg(target_os = "windows")]
fn round_corners(window: &tauri::WebviewWindow) {
    use std::ffi::c_void;
    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut c_void,
            attr: u32,
            value: *const c_void,
            size: u32,
        ) -> i32;
    }
    // DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_ROUND = 2.
    if let Ok(hwnd) = window.hwnd() {
        let pref: u32 = 2;
        unsafe {
            DwmSetWindowAttribute(
                hwnd.0 as *mut c_void,
                33,
                &pref as *const u32 as *const c_void,
                4,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Window blur (Windows acrylic / mica). Toggled from the settings panel.
// ---------------------------------------------------------------------------
#[tauri::command]
fn set_blur(window: Window, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        if enabled {
            apply_acrylic(&window, Some((18, 18, 22, 125))).map_err(|e| e.to_string())?;
        } else {
            clear_acrylic(&window).map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&window, enabled);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Filesystem — read directories and files directly from Rust so the explorer
// can browse any folder the user picks without webview scope wrangling.
// ---------------------------------------------------------------------------
#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip noisy build/VCS dirs but keep dotfiles like .gitignore visible.
        if matches!(name.as_str(), "node_modules" | "target" | ".git") {
            continue;
        }
        out.push(DirEntry {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir: p.is_dir(),
        });
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

// Read an image file and return it as a data: URL so it can be used directly as
// a project icon in the webview (works for png/svg/jpg/etc, including binary).
#[tauri::command]
fn read_image_data_url(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let mime = match path.rsplit('.').next().map(|e| e.to_lowercase()).as_deref() {
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

// ---------------------------------------------------------------------------
// Git — shell out to the system `git` so we reuse the user's credential
// manager (no token juggling needed for push/pull against GitHub).
// ---------------------------------------------------------------------------
fn git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("failed to launch git: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[derive(Serialize)]
struct GitStatus {
    branch: String,
    dirty: bool,
    files: Vec<String>,
}

#[tauri::command]
fn git_status(path: String) -> Result<GitStatus, String> {
    let branch = git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();
    let porcelain = git(&path, &["status", "--porcelain"])?;
    let files: Vec<String> = porcelain
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    Ok(GitStatus {
        branch,
        dirty: !files.is_empty(),
        files,
    })
}

#[tauri::command]
fn git_available() -> bool {
    Command::new("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
fn git_init(path: String) -> Result<String, String> {
    git(&path, &["init"])?;
    // Make sure there's a branch name even before the first commit.
    let _ = git(&path, &["symbolic-ref", "HEAD", "refs/heads/main"]);
    Ok("Initialized repository".into())
}

#[derive(Serialize)]
struct GitFile {
    path: String,
    status: String,
}

#[derive(Serialize)]
struct GitInfo {
    is_repo: bool,
    branch: String,
    has_commits: bool,
    files: Vec<GitFile>,
    ahead: u32,
    behind: u32,
    remote: Option<String>,
}

#[tauri::command]
fn git_info(path: String) -> Result<GitInfo, String> {
    let is_repo = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if !is_repo {
        return Ok(GitInfo {
            is_repo: false,
            branch: String::new(),
            has_commits: false,
            files: vec![],
            ahead: 0,
            behind: 0,
            remote: None,
        });
    }

    let branch = git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_else(|_| "main".into())
        .trim()
        .to_string();
    let has_commits = git(&path, &["rev-parse", "--verify", "HEAD"]).is_ok();

    let porcelain = git(&path, &["status", "--porcelain"]).unwrap_or_default();
    let files = porcelain
        .lines()
        .filter(|l| l.len() > 3)
        .map(|l| GitFile {
            status: l[..2].trim().to_string(),
            path: l[3..].to_string(),
        })
        .collect();

    let remote = git(&path, &["remote", "get-url", "origin"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let (mut ahead, mut behind) = (0u32, 0u32);
    if let Ok(counts) = git(&path, &["rev-list", "--left-right", "--count", "@{u}...HEAD"]) {
        let parts: Vec<&str> = counts.split_whitespace().collect();
        if parts.len() == 2 {
            behind = parts[0].parse().unwrap_or(0);
            ahead = parts[1].parse().unwrap_or(0);
        }
    }

    Ok(GitInfo {
        is_repo: true,
        branch,
        has_commits,
        files,
        ahead,
        behind,
        remote,
    })
}

#[derive(Serialize)]
struct Commit {
    hash: String,
    short: String,
    author: String,
    date: String,
    subject: String,
}

#[tauri::command]
fn git_log(path: String, limit: u32) -> Result<Vec<Commit>, String> {
    // \x1f (unit separator) between fields, one commit per line.
    let fmt = "--pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%s";
    let n = format!("-n{limit}");
    let out = git(&path, &["log", &n, fmt])?;
    let commits = out
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|l| {
            let mut p = l.split('\u{1f}');
            Some(Commit {
                hash: p.next()?.to_string(),
                short: p.next()?.to_string(),
                author: p.next()?.to_string(),
                date: p.next()?.to_string(),
                subject: p.next().unwrap_or("").to_string(),
            })
        })
        .collect();
    Ok(commits)
}

#[tauri::command]
fn git_pull(path: String) -> Result<String, String> {
    git(&path, &["pull", "--ff-only"])
}

#[tauri::command]
fn git_push(path: String) -> Result<String, String> {
    git(&path, &["push"])
}

#[tauri::command]
fn git_commit_all(path: String, message: String) -> Result<String, String> {
    git(&path, &["add", "-A"])?;
    git(&path, &["commit", "-m", &message])
}

// ---------------------------------------------------------------------------
// GitHub login via OAuth Device Flow. Anode's OAuth app client ID is baked in
// below (client IDs are public — only the client *secret* is sensitive, and the
// device flow doesn't use one). Override via ANODE_GITHUB_CLIENT_ID if needed.
// Pushes also work through Git Credential Manager; this adds an explicit
// identity and configures the gh CLI when present.
// ---------------------------------------------------------------------------
const GITHUB_CLIENT_ID: &str = "Ov23liIFael6ExmouS1c";

fn client_id() -> String {
    std::env::var("ANODE_GITHUB_CLIENT_ID").unwrap_or_else(|_| GITHUB_CLIENT_ID.to_string())
}

fn client_configured() -> bool {
    !client_id().is_empty()
}

fn token_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("github.json"))
}

fn store_token(app: &AppHandle, token: &str) -> Result<(), String> {
    let p = token_path(app)?;
    std::fs::write(p, serde_json::json!({ "token": token }).to_string())
        .map_err(|e| e.to_string())
}

fn load_token(app: &AppHandle) -> Option<String> {
    let p = token_path(app).ok()?;
    let s = std::fs::read_to_string(p).ok()?;
    let j: serde_json::Value = serde_json::from_str(&s).ok()?;
    j["token"].as_str().map(|s| s.to_string())
}

// Best-effort: hand the token to the gh CLI so git operations are authed too.
fn configure_gh(token: &str) {
    use std::process::Stdio;
    if let Ok(mut child) = Command::new("gh")
        .args(["auth", "login", "--with-token"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(token.as_bytes());
        }
        let _ = child.wait();
    }
}

#[derive(Serialize)]
struct DeviceStart {
    user_code: String,
    verification_uri: String,
    device_code: String,
    interval: u64,
}

#[tauri::command]
async fn github_device_start() -> Result<DeviceStart, String> {
    if !client_configured() {
        return Err(
            "GitHub OAuth client ID is not set. Add ANODE_GITHUB_CLIENT_ID (see README)."
                .into(),
        );
    }
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id()), ("scope", "repo read:user".into())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(DeviceStart {
        user_code: j["user_code"].as_str().unwrap_or_default().into(),
        verification_uri: j["verification_uri"].as_str().unwrap_or_default().into(),
        device_code: j["device_code"].as_str().unwrap_or_default().into(),
        interval: j["interval"].as_u64().unwrap_or(5),
    })
}

// Poll once. Returns Some(login) on success, None while pending.
#[tauri::command]
async fn github_device_poll(app: AppHandle, device_code: String) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id()),
            ("device_code", device_code),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code".into(),
            ),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(token) = j["access_token"].as_str() {
        store_token(&app, token)?;
        configure_gh(token);
        return Ok(github_login_for(token).await);
    }
    match j["error"].as_str().unwrap_or("") {
        "authorization_pending" | "slow_down" => Ok(None),
        other => Err(other.to_string()),
    }
}

async fn github_login_for(token: &str) -> Option<String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "Anode")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .ok()?;
    let j: serde_json::Value = resp.json().await.ok()?;
    j["login"].as_str().map(|s| s.to_string())
}

// Current identity: stored token first, then fall back to the gh CLI if signed in there.
#[tauri::command]
async fn github_user(app: AppHandle) -> Result<Option<String>, String> {
    if let Some(token) = load_token(&app) {
        if let Some(login) = github_login_for(&token).await {
            return Ok(Some(login));
        }
    }
    if let Ok(out) = Command::new("gh").args(["api", "user", "--jq", ".login"]).output() {
        if out.status.success() {
            let login = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !login.is_empty() {
                return Ok(Some(login));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
fn github_logout(app: AppHandle) -> Result<(), String> {
    if let Ok(p) = token_path(&app) {
        let _ = std::fs::remove_file(p);
    }
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = url;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Pseudo-terminals — a keyed pool so we can run multiple PTYs at once: the
// Claude Code TUI (id "claude") and an integrated shell (id "terminal"). Output
// streams to the webview where xterm.js renders it. No API key for Claude — it
// IS Claude Code, just with Anode's chrome around it.
// ---------------------------------------------------------------------------
struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

#[derive(Clone, Serialize)]
struct PtyOutput {
    id: String,
    chunk: String,
}

fn kill_session(mgr: &PtyManager, id: &str) {
    if let Some(mut s) = mgr.sessions.lock().unwrap().remove(id) {
        let _ = s.child.kill();
    }
}

// `program`: Some("claude") runs Claude Code; anything else opens a shell.
fn build_command(program: Option<&str>) -> CommandBuilder {
    match program {
        Some("claude") => {
            if cfg!(windows) {
                // `claude` is usually a .cmd shim, so go through cmd.exe (PATHEXT).
                let mut c = CommandBuilder::new("cmd");
                c.arg("/c");
                c.arg("claude");
                c
            } else {
                CommandBuilder::new("claude")
            }
        }
        _ => {
            if cfg!(windows) {
                CommandBuilder::new("powershell")
            } else {
                CommandBuilder::new(std::env::var("SHELL").unwrap_or_else(|_| "bash".into()))
            }
        }
    }
}

#[tauri::command]
fn pty_start(
    app: AppHandle,
    mgr: State<PtyManager>,
    id: String,
    program: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    kill_session(&mgr, &id);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = build_command(program.as_deref());
    if let Some(dir) = cwd {
        if !dir.is_empty() {
            cmd.cwd(dir);
        }
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    mgr.sessions.lock().unwrap().insert(
        id.clone(),
        PtySession {
            writer,
            master: pair.master,
            child,
        },
    );

    let emit_id = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if app
                        .emit(
                            "pty://output",
                            PtyOutput {
                                id: emit_id.clone(),
                                chunk,
                            },
                        )
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("pty://exit", emit_id.clone());
    });

    Ok(())
}

#[tauri::command]
fn pty_write(mgr: State<PtyManager>, id: String, data: String) -> Result<(), String> {
    if let Some(s) = mgr.sessions.lock().unwrap().get_mut(&id) {
        s.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        s.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_resize(mgr: State<PtyManager>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(s) = mgr.sessions.lock().unwrap().get(&id) {
        s.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_kill(mgr: State<PtyManager>, id: String) {
    kill_session(&mgr, &id);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::default())
        .setup(|app| {
            // Apply acrylic on launch so the blurred background is on by default.
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_acrylic;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = apply_acrylic(&win, Some((18, 18, 22, 125)));
                    round_corners(&win);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_blur,
            read_dir,
            read_file,
            write_file,
            read_image_data_url,
            git_status,
            git_available,
            git_init,
            git_info,
            git_log,
            git_pull,
            git_push,
            git_commit_all,
            github_device_start,
            github_device_poll,
            github_user,
            github_logout,
            open_url,
            pty_start,
            pty_write,
            pty_resize,
            pty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running Anode");
}
