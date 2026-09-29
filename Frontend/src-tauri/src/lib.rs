use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn is_port_in_use(port: u16) -> bool {
    let addr_str = format!("127.0.0.1:{}", port);
    if let Ok(addr) = addr_str.parse() {
        TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
    } else {
        false
    }
}

fn find_workspace_root() -> PathBuf {
    // 1. Check parent hierarchy of current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let mut cur = cwd.clone();
        for _ in 0..5 {
            if cur.join("Backend").is_dir() && cur.join(".venv").is_dir() {
                return cur;
            }
            if let Some(parent) = cur.parent() {
                cur = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // 2. Check parent hierarchy of current executable
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.clone();
        for _ in 0..6 {
            if cur.join("Backend").is_dir() && cur.join(".venv").is_dir() {
                return cur;
            }
            if let Some(parent) = cur.parent() {
                cur = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // 3. Fallback to standard project location
    PathBuf::from(r"C:\Users\naiks\OneDrive\Desktop\Huhtamaki software")
}

fn find_python_executable(workspace: &Path) -> PathBuf {
    let venv_python = workspace.join(".venv").join("Scripts").join("python.exe");
    if venv_python.exists() {
        return venv_python;
    }
    PathBuf::from("python")
}

fn spawn_backend_server(backend_child: Arc<Mutex<Option<Child>>>) {
    if is_port_in_use(8000) {
        println!("[Tauri] Backend server is already running on port 8000.");
        return;
    }

    let workspace = find_workspace_root();
    let backend_dir = workspace.join("Backend");
    let python_exe = find_python_executable(&workspace);

    println!("[Tauri] Starting Huhtamaki Vision Backend server...");
    println!("[Tauri] Workspace: {:?}", workspace);
    println!("[Tauri] Python: {:?}", python_exe);
    println!("[Tauri] Backend Directory: {:?}", backend_dir);

    let mut cmd = Command::new(&python_exe);
    #[cfg(debug_assertions)]
    {
        cmd.args(["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]);
    }
    #[cfg(not(debug_assertions))]
    {
        cmd.args(["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"]);
    }
    cmd.current_dir(&backend_dir);

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            println!("[Tauri] Backend server started successfully with PID {}", pid);
            if let Ok(mut lock) = backend_child.lock() {
                *lock = Some(child);
            }
        }
        Err(err) => {
            eprintln!("[Tauri] Failed to start backend server: {}", err);
        }
    }
}

fn stop_backend_server(backend_child: &Arc<Mutex<Option<Child>>>) {
    if let Ok(mut lock) = backend_child.lock() {
        if let Some(mut child) = lock.take() {
            let pid = child.id();
            println!("[Tauri] Stopping backend server (PID {})...", pid);
            let _ = child.kill();

            #[cfg(windows)]
            {
                let mut kill_cmd = Command::new("taskkill");
                kill_cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
                kill_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = kill_cmd.status();
            }
            println!("[Tauri] Backend server clean exit complete.");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_child = Arc::new(Mutex::new(None));
    let backend_child_clone = Arc::clone(&backend_child);

    let app = tauri::Builder::default()
        .setup(move |_app| {
            spawn_backend_server(backend_child_clone);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let backend_child_exit = Arc::clone(&backend_child);
    app.run(move |_app_handle, event| match event {
        tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } => {
            stop_backend_server(&backend_child_exit);
        }
        _ => {}
    });
}
