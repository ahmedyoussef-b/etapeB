use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const USERS_FILE: &str = "users.json";
const SESSION_FILE: &str = "session.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalUser {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub password_hash: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuthSession {
    pub user_id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub logged_in_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct UsersStore {
    pub users: Vec<LocalUser>,
}

fn user_data_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("NexaFlow");
        }
    }
    PathBuf::from(".")
}

fn users_path_for(base: &Path) -> PathBuf {
    base.join(USERS_FILE)
}

fn session_path_for(base: &Path) -> PathBuf {
    base.join(SESSION_FILE)
}

fn read_users_at(path: &Path) -> Result<UsersStore, String> {
    if !path.exists() {
        return Ok(UsersStore::default());
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Impossible de lire users.json: {}", e))?;
    let store: UsersStore = serde_json::from_str(&content)
        .map_err(|e| format!("users.json corrompu: {}", e))?;
    Ok(store)
}

fn write_users_at(path: &Path, store: &UsersStore) -> Result<(), String> {
    let parent = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|e| format!("Impossible de créer {}: {}", parent.display(), e))?;
    let content = serde_json::to_string_pretty(store)
        .map_err(|e| format!("Impossible de sérialiser users.json: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("Impossible d'écrire users.json: {}", e))?;
    Ok(())
}

fn read_session_at(path: &Path) -> Result<Option<AuthSession>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Impossible de lire session.json: {}", e))?;
    let session: AuthSession = serde_json::from_str(&content)
        .map_err(|e| format!("session.json corrompu: {}", e))?;
    Ok(Some(session))
}

fn write_session_at(path: &Path, session: &AuthSession) -> Result<(), String> {
    let parent = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|e| format!("Impossible de créer {}: {}", parent.display(), e))?;
    let content = serde_json::to_string_pretty(session)
        .map_err(|e| format!("Impossible de sérialiser session.json: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("Impossible d'écrire session.json: {}", e))?;
    Ok(())
}

fn clear_session_at(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Impossible de supprimer session.json: {}", e))?;
    }
    Ok(())
}

fn hash_password(password: &str) -> Result<String, String> {
    let hash = bcrypt::hash(password, 10)
        .map_err(|e| format!("Impossible de hasher le mot de passe: {}", e))?;
    Ok(hash)
}

fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    bcrypt::verify(password, hash)
        .map_err(|e| format!("Impossible de vérifier le mot de passe: {}", e))
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn ensure_default_admin_at(base: &Path) -> Result<(), String> {
    let path = users_path_for(base);
    let mut store = read_users_at(&path)?;

    if store.users.iter().any(|u| u.role == "admin") {
        return Ok(());
    }

    let password_hash = hash_password("Admin123!")?;
    let admin = LocalUser {
        id: uuid::Uuid::new_v4().to_string(),
        email: "admin@nexaflow.local".to_string(),
        name: "Administrateur".to_string(),
        role: "admin".to_string(),
        password_hash,
        created_at: now_iso(),
    };

    store.users.push(admin);
    write_users_at(&path, &store)?;
    Ok(())
}

pub fn ensure_default_admin(app: &AppHandle) -> Result<(), String> {
    let _ = app;
    ensure_default_admin_at(&user_data_dir())
}

fn login_at(base: &Path, email: String, password: String) -> Result<AuthSession, String> {
    let email = email.trim().to_lowercase();
    if email.is_empty() || password.is_empty() {
        return Err("Email ou mot de passe vide".to_string());
    }

    let path = users_path_for(base);
    let store = read_users_at(&path)?;
    let user = store
        .users
        .iter()
        .find(|u| u.email == email)
        .ok_or_else(|| "Email ou mot de passe incorrect".to_string())?;

    let valid = verify_password(&password, &user.password_hash)?;
    if !valid {
        return Err("Email ou mot de passe incorrect".to_string());
    }

    let session = AuthSession {
        user_id: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: user.role.clone(),
        logged_in_at: now_iso(),
    };

    let session_path = session_path_for(base);
    write_session_at(&session_path, &session)?;
    Ok(session)
}

#[tauri::command]
pub fn login(email: String, password: String) -> Result<AuthSession, String> {
    login_at(&user_data_dir(), email, password)
}

fn logout_at(base: &Path) -> Result<(), String> {
    let path = session_path_for(base);
    clear_session_at(&path)
}

#[tauri::command]
pub fn logout() -> Result<(), String> {
    logout_at(&user_data_dir())
}

fn get_session_at(base: &Path) -> Result<Option<AuthSession>, String> {
    let path = session_path_for(base);
    read_session_at(&path)
}

#[tauri::command]
pub fn get_session() -> Result<Option<AuthSession>, String> {
    get_session_at(&user_data_dir())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn test_dir() -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("nexaflow-auth-test-{}", n));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_hash_and_verify_password_ok() {
        let password = "Test123!";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
    }

    #[test]
    fn test_hash_and_verify_password_wrong() {
        let hash = hash_password("Test123!").unwrap();
        assert!(!verify_password("WrongPassword", &hash).unwrap());
    }

    #[test]
    fn test_hash_is_not_plaintext() {
        let hash = hash_password("Test123!").unwrap();
        assert!(!hash.contains("Test123!"));
        assert!(hash.len() > 20);
    }

    #[test]
    fn test_ensure_default_admin_creates_admin() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        let path = users_path_for(&base);
        let store = read_users_at(&path).unwrap();
        assert_eq!(store.users.len(), 1);
        assert_eq!(store.users[0].email, "admin@nexaflow.local");
        assert_eq!(store.users[0].role, "admin");
        assert!(store.users[0].password_hash.len() > 20);

        cleanup(&base);
    }

    #[test]
    fn test_ensure_default_admin_idempotent() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();
        ensure_default_admin_at(&base).unwrap();

        let path = users_path_for(&base);
        let store = read_users_at(&path).unwrap();
        assert_eq!(store.users.len(), 1);

        cleanup(&base);
    }

    #[test]
    fn test_login_success() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        let session = login_at(&base, "admin@nexaflow.local".to_string(), "Admin123!".to_string());
        assert!(session.is_ok());
        let session = session.unwrap();
        assert_eq!(session.email, "admin@nexaflow.local");
        assert_eq!(session.role, "admin");

        cleanup(&base);
    }

    #[test]
    fn test_login_wrong_password() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        let result = login_at(&base, "admin@nexaflow.local".to_string(), "WrongPassword".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Email ou mot de passe incorrect"));

        cleanup(&base);
    }

    #[test]
    fn test_login_unknown_email() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        let result = login_at(&base, "unknown@example.com".to_string(), "SomePass".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Email ou mot de passe incorrect"));

        cleanup(&base);
    }

    #[test]
    fn test_login_email_normalization() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        let session = login_at(&base, "  ADMIN@NEXAFLOW.LOCAL  ".to_string(), "Admin123!".to_string());
        assert!(session.is_ok());

        cleanup(&base);
    }

    #[test]
    fn test_get_session_before_login() {
        let base = test_dir();
        let session = get_session_at(&base).unwrap();
        assert!(session.is_none());

        cleanup(&base);
    }

    #[test]
    fn test_get_session_after_login() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        login_at(&base, "admin@nexaflow.local".to_string(), "Admin123!".to_string()).unwrap();
        let session = get_session_at(&base).unwrap();
        assert!(session.is_some());
        assert_eq!(session.unwrap().email, "admin@nexaflow.local");

        cleanup(&base);
    }

    #[test]
    fn test_logout_clears_session() {
        let base = test_dir();
        ensure_default_admin_at(&base).unwrap();

        login_at(&base, "admin@nexaflow.local".to_string(), "Admin123!".to_string()).unwrap();
        let session = get_session_at(&base).unwrap();
        assert!(session.is_some());

        logout_at(&base).unwrap();
        let session = get_session_at(&base).unwrap();
        assert!(session.is_none());

        cleanup(&base);
    }

    #[test]
    fn test_logout_idempotent() {
        let base = test_dir();
        logout_at(&base).unwrap();
        logout_at(&base).unwrap();

        cleanup(&base);
    }
}
