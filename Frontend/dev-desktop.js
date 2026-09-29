import { spawn } from 'child_process';
import net from 'net';

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function main() {
  const isViteRunning = await isPortOpen(5173);
  let viteProcess = null;

  if (!isViteRunning) {
    console.log('[Live HMR] Starting Vite dev server on http://localhost:5173...');
    viteProcess = spawn('npm.cmd', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      windowsHide: false,
    });

    // Wait until port 5173 is responding
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (await isPortOpen(5173)) {
        break;
      }
    }
    console.log('[Live HMR] Vite development server is ready with Instant Hot-Reload.');
  } else {
    console.log('[Live HMR] Vite development server is already active on http://localhost:5173.');
  }

  console.log('[Live HMR] Launching Tauri Desktop Application...');
  const tauriProcess = spawn('cargo', ['run', '--manifest-path', 'src-tauri/Cargo.toml'], {
    stdio: 'inherit',
    shell: true,
  });

  const cleanup = () => {
    if (viteProcess && !viteProcess.killed) {
      console.log('[Live HMR] Stopping Vite development server...');
      spawn('taskkill', ['/F', '/T', '/PID', viteProcess.pid.toString()], { shell: true });
    }
  };

  tauriProcess.on('exit', (code) => {
    cleanup();
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Live HMR Error]', err);
  process.exit(1);
});
