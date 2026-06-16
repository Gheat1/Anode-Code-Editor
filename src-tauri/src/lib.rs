use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, Window};

// Spawn helper processes (git, gh, cmd) WITHOUT popping a console window on
// Windows. A plain `Command` spawn flashes a console window and steals focus on
// every call — and opening Source Control fires a dozen `git` subcommands, so
// the screen filled with flickering terminals and the app froze. CREATE_NO_WINDOW
// suppresses that. No-op on macOS/Linux.
fn sys_command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd
}

// Run a blocking closure off the UI thread. Synchronous Tauri commands execute
// on the main thread, so chaining several blocking `git` subprocess calls there
// froze the window; this hands the work to a background thread and awaits it.
async fn run_blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

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

// Acrylic blur is intentionally disabled: a transparent window with a live
// acrylic backdrop forces the compositor to re-blend every translucent layer on
// every repaint, which made the whole app laggy in the webview. The window is
// opaque now. Kept as a no-op so the frontend call stays valid.
#[tauri::command]
fn set_blur(window: Window, enabled: bool) -> Result<(), String> {
    let _ = (&window, enabled);
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
        // Use the file type the directory iterator already gave us (no extra
        // stat syscall); only follow a symlink to classify it as dir/file.
        let is_dir = match entry.file_type() {
            Ok(ft) if ft.is_symlink() => p.is_dir(),
            Ok(ft) => ft.is_dir(),
            Err(_) => p.is_dir(),
        };
        out.push(DirEntry {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir,
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
    let out = sys_command("git")
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
async fn git_status(path: String) -> Result<GitStatus, String> {
    run_blocking(move || {
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
    })
    .await
}

#[tauri::command]
async fn git_available() -> bool {
    tauri::async_runtime::spawn_blocking(|| {
        sys_command("git")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}

#[tauri::command]
async fn git_init(path: String) -> Result<String, String> {
    run_blocking(move || {
        git(&path, &["init"])?;
        // Make sure there's a branch name even before the first commit.
        let _ = git(&path, &["symbolic-ref", "HEAD", "refs/heads/main"]);
        Ok("Initialized repository".into())
    })
    .await
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
    upstream: bool, // whether the branch tracks an upstream (@{u} exists)
}

#[tauri::command]
async fn git_info(path: String) -> Result<GitInfo, String> {
    run_blocking(move || {
        let is_repo = sys_command("git")
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
                upstream: false,
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

        let upstream = git(
            &path,
            &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        )
        .is_ok();

        let (mut ahead, mut behind) = (0u32, 0u32);
        if upstream {
            if let Ok(counts) =
                git(&path, &["rev-list", "--left-right", "--count", "@{u}...HEAD"])
            {
                let parts: Vec<&str> = counts.split_whitespace().collect();
                if parts.len() == 2 {
                    behind = parts[0].parse().unwrap_or(0);
                    ahead = parts[1].parse().unwrap_or(0);
                }
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
            upstream,
        })
    })
    .await
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
async fn git_log(path: String, limit: u32) -> Result<Vec<Commit>, String> {
    run_blocking(move || {
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
    })
    .await
}

#[tauri::command]
async fn git_pull(path: String) -> Result<String, String> {
    run_blocking(move || git(&path, &["pull", "--ff-only"])).await
}

#[tauri::command]
async fn git_push(path: String) -> Result<String, String> {
    run_blocking(move || git(&path, &["push"])).await
}

// First push for a branch with no upstream yet: pushes to origin and sets it.
#[tauri::command]
async fn git_publish(path: String) -> Result<String, String> {
    run_blocking(move || git(&path, &["push", "-u", "origin", "HEAD"])).await
}

#[tauri::command]
async fn git_commit_all(path: String, message: String) -> Result<String, String> {
    run_blocking(move || {
        git(&path, &["add", "-A"])?;
        git(&path, &["commit", "-m", &message])
    })
    .await
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

// Persist the token plus the resolved login, so we can show the signed-in user
// instantly (and stay signed in) even when the network check later fails.
fn store_token(app: &AppHandle, token: &str, login: Option<&str>) -> Result<(), String> {
    let p = token_path(app)?;
    std::fs::write(p, serde_json::json!({ "token": token, "login": login }).to_string())
        .map_err(|e| e.to_string())
}

fn load_token(app: &AppHandle) -> Option<String> {
    let p = token_path(app).ok()?;
    let s = std::fs::read_to_string(p).ok()?;
    let j: serde_json::Value = serde_json::from_str(&s).ok()?;
    j["token"].as_str().map(|s| s.to_string())
}

fn load_login(app: &AppHandle) -> Option<String> {
    let p = token_path(app).ok()?;
    let s = std::fs::read_to_string(p).ok()?;
    let j: serde_json::Value = serde_json::from_str(&s).ok()?;
    j["login"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string())
}

// Best-effort: hand the token to the gh CLI so git operations are authed too.
fn configure_gh(token: &str) {
    use std::process::Stdio;
    if let Ok(mut child) = sys_command("gh")
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
        let login = github_login_for(token).await;
        store_token(&app, token, login.as_deref())?;
        configure_gh(token);
        return Ok(login);
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

// Current identity: verify the stored token over the network, but if that check
// fails (offline, rate-limited, transient) fall back to the login we remembered
// at sign-in so the user stays signed in. Then the gh CLI, as a last resort.
#[tauri::command]
async fn github_user(app: AppHandle) -> Result<Option<String>, String> {
    if let Some(token) = load_token(&app) {
        if let Some(login) = github_login_for(&token).await {
            // Refresh the cached login opportunistically.
            let _ = store_token(&app, &token, Some(&login));
            return Ok(Some(login));
        }
        // Network check failed but we have a token + remembered login → trust it.
        if let Some(login) = load_login(&app) {
            return Ok(Some(login));
        }
    }
    let gh = tauri::async_runtime::spawn_blocking(|| {
        sys_command("gh")
            .args(["api", "user", "--jq", ".login"])
            .output()
            .ok()
    })
    .await
    .ok()
    .flatten();
    if let Some(out) = gh {
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
    #[cfg(target_os = "windows")]
    let res = sys_command("cmd").args(["/c", "start", "", &url]).spawn();
    #[cfg(target_os = "macos")]
    let res = sys_command("open").arg(&url).spawn();
    #[cfg(target_os = "linux")]
    let res = sys_command("xdg-open").arg(&url).spawn();
    res.map(|_| ()).map_err(|e| e.to_string())
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

// `program`: Some("claude") runs Claude Code (with the given flags); anything
// else opens a shell.
fn build_command(program: Option<&str>, args: &[String]) -> CommandBuilder {
    match program {
        Some("claude") => {
            let mut c = if cfg!(windows) {
                // `claude` is usually a .cmd shim, so go through cmd.exe (PATHEXT).
                let mut c = CommandBuilder::new("cmd");
                c.arg("/c");
                c.arg("claude");
                c
            } else {
                CommandBuilder::new("claude")
            };
            for a in args {
                c.arg(a);
            }
            c
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
    args: Option<Vec<String>>,
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

    let mut cmd = build_command(program.as_deref(), &args.unwrap_or_default());
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
            // Opaque window, just rounded corners via DWM — no acrylic (it forces
            // expensive per-frame recompositing in the webview).
            #[cfg(target_os = "windows")]
            {
                if let Some(win) = app.get_webview_window("main") {
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
            git_publish,
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
