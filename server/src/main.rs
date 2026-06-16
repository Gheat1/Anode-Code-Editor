// Anode sync server — accounts + per-user settings blob.
//
// Endpoints (all JSON, token auth via `Authorization: Bearer <token>`):
//   GET  /api/health
//   POST /api/auth/signup   { email, password } -> { token, email }
//   POST /api/auth/login    { email, password } -> { token, email }
//   POST /api/auth/logout                       -> {}
//   GET  /api/me                                -> { email }
//   GET  /api/settings                          -> { data, updated_at }
//   PUT  /api/settings      { data }            -> { updated_at }
//
// Storage is SQLite (bundled — no system lib needed). Passwords are Argon2id
// hashed; session tokens are random and stored as their SHA-256 hash.

use argon2::password_hash::{rand_core::OsRng as ArgonOsRng, PasswordHash, SaltString};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rand::RngCore;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;

type Db = Arc<Mutex<Connection>>;

// ---- error helper --------------------------------------------------------
struct ApiErr(StatusCode, String);
impl IntoResponse for ApiErr {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({ "error": self.1 }))).into_response()
    }
}
fn err(code: StatusCode, msg: &str) -> ApiErr {
    ApiErr(code, msg.to_string())
}

// ---- helpers -------------------------------------------------------------
fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn hash_password(pw: &str) -> Result<String, ApiErr> {
    let salt = SaltString::generate(&mut ArgonOsRng);
    Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "hash error"))
}
fn verify_password(pw: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(pw.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

fn new_token() -> String {
    let mut b = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut b);
    hex::encode(b)
}
fn token_hash(t: &str) -> String {
    hex::encode(Sha256::digest(t.as_bytes()))
}

fn require_auth(db: &Db, headers: &HeaderMap) -> Result<i64, ApiErr> {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "missing token"))?;
    let th = token_hash(token);
    let conn = db.lock().unwrap();
    conn.query_row(
        "SELECT user_id FROM tokens WHERE token_hash = ?1",
        params![th],
        |r| r.get::<_, i64>(0),
    )
    .map_err(|_| err(StatusCode::UNAUTHORIZED, "invalid token"))
}

// ---- request / response types -------------------------------------------
#[derive(Deserialize)]
struct AuthReq {
    email: String,
    password: String,
}
#[derive(Serialize)]
struct AuthResp {
    token: String,
    email: String,
}
#[derive(Serialize)]
struct MeResp {
    email: String,
}
#[derive(Deserialize)]
struct SettingsBody {
    data: Value,
}
#[derive(Serialize)]
struct SettingsResp {
    data: Option<Value>,
    updated_at: Option<i64>,
}
#[derive(Serialize)]
struct PutResp {
    updated_at: i64,
}

// ---- handlers ------------------------------------------------------------
async fn health() -> &'static str {
    "ok"
}

async fn signup(State(db): State<Db>, Json(b): Json<AuthReq>) -> Result<Json<AuthResp>, ApiErr> {
    let email = b.email.trim().to_lowercase();
    if !email.contains('@') || email.len() < 3 {
        return Err(err(StatusCode::BAD_REQUEST, "enter a valid email"));
    }
    if b.password.len() < 8 {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "password must be at least 8 characters",
        ));
    }
    let ph = hash_password(&b.password)?;
    let now = now_secs();
    let token = new_token();
    let th = token_hash(&token);

    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?1, ?2, ?3)",
        params![email, ph, now],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            err(StatusCode::CONFLICT, "email already registered")
        } else {
            err(StatusCode::INTERNAL_SERVER_ERROR, "db error")
        }
    })?;
    let uid = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO tokens (token_hash, user_id, created_at) VALUES (?1, ?2, ?3)",
        params![th, uid, now],
    )
    .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "db error"))?;

    Ok(Json(AuthResp { token, email }))
}

async fn login(State(db): State<Db>, Json(b): Json<AuthReq>) -> Result<Json<AuthResp>, ApiErr> {
    let email = b.email.trim().to_lowercase();
    let token = new_token();
    let th = token_hash(&token);
    let now = now_secs();

    let conn = db.lock().unwrap();
    let row: Result<(i64, String), _> = conn.query_row(
        "SELECT id, password_hash FROM users WHERE email = ?1",
        params![email],
        |r| Ok((r.get(0)?, r.get(1)?)),
    );
    let (uid, ph) = row.map_err(|_| err(StatusCode::UNAUTHORIZED, "wrong email or password"))?;
    if !verify_password(&b.password, &ph) {
        return Err(err(StatusCode::UNAUTHORIZED, "wrong email or password"));
    }
    conn.execute(
        "INSERT INTO tokens (token_hash, user_id, created_at) VALUES (?1, ?2, ?3)",
        params![th, uid, now],
    )
    .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "db error"))?;

    Ok(Json(AuthResp { token, email }))
}

async fn logout(State(db): State<Db>, headers: HeaderMap) -> Result<Json<Value>, ApiErr> {
    if let Some(token) = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
    {
        let conn = db.lock().unwrap();
        let _ = conn.execute(
            "DELETE FROM tokens WHERE token_hash = ?1",
            params![token_hash(token)],
        );
    }
    Ok(Json(serde_json::json!({})))
}

async fn me(State(db): State<Db>, headers: HeaderMap) -> Result<Json<MeResp>, ApiErr> {
    let uid = require_auth(&db, &headers)?;
    let conn = db.lock().unwrap();
    let email: String = conn
        .query_row("SELECT email FROM users WHERE id = ?1", params![uid], |r| {
            r.get(0)
        })
        .map_err(|_| err(StatusCode::NOT_FOUND, "user not found"))?;
    Ok(Json(MeResp { email }))
}

async fn get_settings(
    State(db): State<Db>,
    headers: HeaderMap,
) -> Result<Json<SettingsResp>, ApiErr> {
    let uid = require_auth(&db, &headers)?;
    let conn = db.lock().unwrap();
    let row: Result<(String, i64), _> = conn.query_row(
        "SELECT data, updated_at FROM settings WHERE user_id = ?1",
        params![uid],
        |r| Ok((r.get(0)?, r.get(1)?)),
    );
    match row {
        Ok((data, updated_at)) => Ok(Json(SettingsResp {
            data: serde_json::from_str(&data).ok(),
            updated_at: Some(updated_at),
        })),
        Err(_) => Ok(Json(SettingsResp {
            data: None,
            updated_at: None,
        })),
    }
}

async fn put_settings(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(b): Json<SettingsBody>,
) -> Result<Json<PutResp>, ApiErr> {
    let uid = require_auth(&db, &headers)?;
    let now = now_secs();
    let data = serde_json::to_string(&b.data)
        .map_err(|_| err(StatusCode::BAD_REQUEST, "invalid settings json"))?;
    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT INTO settings (user_id, data, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id) DO UPDATE SET data = ?2, updated_at = ?3",
        params![uid, data, now],
    )
    .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "db error"))?;
    Ok(Json(PutResp { updated_at: now }))
}

fn init_db(conn: &Connection) {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS tokens (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS settings (
            user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER NOT NULL
         );",
    )
    .expect("failed to init database");
}

#[tokio::main]
async fn main() {
    let db_path = std::env::var("ANODE_DB").unwrap_or_else(|_| "anode.db".into());
    let bind = std::env::var("ANODE_BIND").unwrap_or_else(|_| "127.0.0.1:8787".into());

    let conn = Connection::open(&db_path).expect("failed to open database");
    init_db(&conn);
    let db: Db = Arc::new(Mutex::new(conn));

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/signup", post(signup))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/me", get(me))
        .route("/api/settings", get(get_settings).put(put_settings))
        // Bearer-token auth (no cookies), so any-origin CORS is safe.
        .layer(CorsLayer::permissive())
        .with_state(db);

    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .expect("failed to bind");
    println!("anode-sync listening on http://{bind}  (db: {db_path})");
    axum::serve(listener, app).await.expect("server error");
}
