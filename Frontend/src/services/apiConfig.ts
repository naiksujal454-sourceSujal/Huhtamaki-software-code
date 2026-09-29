// Centralized configuration for API & WebSocket URLs supporting both Vite Dev & Tauri Desktop

export const isTauriEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI_INTERNALS__' in window ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost' ||
    (window.location.port !== '5173' && window.location.port !== '3000')
  );
};

export const API_BASE_URL = isTauriEnvironment() ? 'http://127.0.0.1:8000' : '';

export const getApiUrl = (endpoint: string): string => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://') || endpoint.startsWith('data:')) return endpoint;
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalized}`;
};

export const getWebSocketUrl = (): string => {
  if (isTauriEnvironment()) {
    return 'ws://127.0.0.1:8000/api/ws/live';
  }
  // In local browser development (localhost/127.0.0.1), connect directly to backend port 8000 for instant connection
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'ws://127.0.0.1:8000/api/ws/live';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ws/live`;
};
