import { getApiUrl, getWebSocketUrl } from './apiConfig';

export interface RecipeItem {
  id: string;
  name: string;
  type: string;
  targetCode: string;
  image: string;
  rawImage?: string;
  processedImage?: string;
  description?: string;
  createdAt?: string;
}

export interface LiveCounters {
  total: number;
  ok_count: number;
  nok_count: number;
  pass_rate: number;
  current_ppm: number;
  current_mpm?: number;
  session_id?: string;
}

export interface InspectionEvent {
  id: number;
  status: 'OK' | 'NOK';
  scanned_code: string;
  expected_code: string;
  reason: string;
  confidence: number;
  inspected_at: string;
  latency_ms: number;
  image_url: string;
  processed_image_url?: string;
  raw_image_url?: string;
  recipe_name: string;
}

export interface AlarmDetails {
  defect_id: number;
  scanned_code?: string;
  expected_code?: string;
  reason: string;
  timestamp: string;
  image_url?: string;
  processed_image_url?: string;
  raw_image_url?: string;
  alert_key?: string;
  alert_label?: string;
  description?: string;
  priority?: string;
}

export interface InspectionStatusResponse {
  state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';
  mode: 'simulation' | 'hardware';
  active_recipe: RecipeItem | null;
  alarm_active: boolean;
  alarm_details: AlarmDetails | null;
  conveyor_interlocked: boolean;
  buzzer_active: boolean;
  counters: LiveCounters;
  recent_events: InspectionEvent[];
}

// REST API calls
export async function fetchRecipesFromBackend(): Promise<RecipeItem[]> {
  const resp = await fetch(getApiUrl('/api/recipes'));
  if (!resp.ok) throw new Error('Failed to fetch recipes');
  return resp.json();
}

export async function updateRecipeBackend(
  recipeId: string,
  data: {
    recipeName: string;
    targetCode?: string;
    imageData?: string;
    description?: string;
  }
): Promise<{ success: boolean; recipe: RecipeItem; message: string }> {
  const resp = await fetch(getApiUrl(`/api/recipes/${recipeId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update recipe');
  }
  return resp.json();
}

export async function deleteRecipeBackend(recipeId: string): Promise<{ success: boolean; message: string }> {
  const resp = await fetch(getApiUrl(`/api/recipes/${recipeId}`), {
    method: 'DELETE',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete recipe');
  }
  return resp.json();
}

export async function startInspection(
  recipeId: string,
  recipe?: RecipeItem,
  mode: 'simulation' | 'hardware' = 'simulation',
  simulateDefects: boolean = true,
  stopOnDefect: boolean = true,
) {
  const resp = await fetch(getApiUrl('/api/inspection/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId, recipe, mode, simulateDefects, stopOnDefect }),
  });
  if (!resp.ok) throw new Error('Failed to start inspection');
  return resp.json();
}

export async function injectDefect() {
  const resp = await fetch(getApiUrl('/api/inspection/inject-defect'), { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to inject defect');
  return resp.json();
}

export async function setDefectConfig(simulateDefects: boolean, stopOnDefect?: boolean) {
  const resp = await fetch(getApiUrl('/api/inspection/defect-config'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateDefects, stopOnDefect }),
  });
  if (!resp.ok) throw new Error('Failed to update defect configuration');
  return resp.json();
}

export async function pauseInspection() {
  const resp = await fetch(getApiUrl('/api/inspection/pause'), { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to pause inspection');
  return resp.json();
}

export async function resumeInspection() {
  const resp = await fetch(getApiUrl('/api/inspection/resume'), { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to resume inspection');
  return resp.json();
}

export async function stopInspection() {
  const resp = await fetch(getApiUrl('/api/inspection/stop'), { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to stop inspection');
  return resp.json();
}

export async function acknowledgeAlarm() {
  const resp = await fetch(getApiUrl('/api/inspection/acknowledge-alarm'), { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to acknowledge alarm');
  return resp.json();
}

export async function getInspectionStatus(): Promise<InspectionStatusResponse> {
  const resp = await fetch(getApiUrl('/api/inspection/status'));
  if (!resp.ok) throw new Error('Failed to get status');
  return resp.json();
}

export async function testBuzzerPulse() {
  const resp = await fetch(getApiUrl('/api/system/test-buzzer'), { method: 'POST' });
  if (!resp.ok) throw new Error('Failed to test buzzer');
  return resp.json();
}

// WebSocket Connection Handler with Instant Rapid-Reconnect & Health Polling
export function connectLiveInspectionWebSocket(
  onResult: (event: InspectionEvent, counters: LiveCounters, recentEvents?: InspectionEvent[]) => void,
  onAlarm: (alarm: AlarmDetails, counters: LiveCounters, recentEvents?: InspectionEvent[]) => void,
  onStateChange: (state: string, counters: LiveCounters, recipe: any, recentEvents?: InspectionEvent[]) => void
) {
  let ws: WebSocket | null = null;
  let reconnectTimeout: any = null;
  let healthPollInterval: any = null;
  let pingInterval: any = null;
  let isClosedIntentionally = false;
  let retryCount = 0;
  let isConnecting = false;

  const stopHealthPolling = () => {
    if (healthPollInterval) {
      clearInterval(healthPollInterval);
      healthPollInterval = null;
    }
  };

  const startHealthPolling = () => {
    if (healthPollInterval || isClosedIntentionally) return;
    // Rapidly poll /health every 350ms so as soon as backend boots, we connect immediately!
    healthPollInterval = setInterval(async () => {
      if (isClosedIntentionally) {
        stopHealthPolling();
        return;
      }
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        stopHealthPolling();
        return;
      }
      try {
        const res = await fetch(getApiUrl('/api/health'), { cache: 'no-store' });
        if (res.ok) {
          stopHealthPolling();
          connect();
        }
      } catch {
        // Backend still booting, continue polling
      }
    }, 350);
  };

  const scheduleReconnect = () => {
    if (isClosedIntentionally || reconnectTimeout) return;
    // Fast reconnect ladder: 250ms -> 400ms -> 600ms -> 1000ms max
    const delay = retryCount === 0 ? 250 : Math.min(250 + retryCount * 200, 1200);
    retryCount++;
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connect();
    }, delay);
    startHealthPolling();
  };

  const connect = () => {
    if (isClosedIntentionally || isConnecting) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    isConnecting = true;
    try {
      const url = getWebSocketUrl();
      ws = new WebSocket(url);

      ws.onopen = () => {
        isConnecting = false;
        retryCount = 0;
        stopHealthPolling();
        if (isClosedIntentionally) {
          ws?.close(1000, 'Closed intentionally');
          return;
        }
        console.log('[WebSocket] Connected to Live Inspection Stream:', url);

        // Start heartbeat to keep connection alive
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send('ping');
            } catch {}
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INSPECTION_RESULT') {
            onResult(payload.data, payload.counters, payload.recent_events);
          } else if (payload.type === 'CRITICAL_ALARM') {
            onAlarm(payload.data, payload.counters, payload.recent_events);
          } else if (payload.type === 'STATE_CHANGE') {
            onStateChange(payload.state, payload.counters, payload.recipe, payload.recent_events);
          }
        } catch {
          // Non-JSON or pong message, ignore
        }
      };

      ws.onclose = () => {
        isConnecting = false;
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (!isClosedIntentionally) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        isConnecting = false;
        try {
          ws?.close();
        } catch {}
      };
    } catch {
      isConnecting = false;
      if (!isClosedIntentionally) {
        scheduleReconnect();
      }
    }
  };

  // Immediate connect on mount
  connect();

  // Instant reconnect on tab focus or network online
  const handleFocusOrOnline = () => {
    if (!isClosedIntentionally && (!ws || ws.readyState !== WebSocket.OPEN)) {
      connect();
    }
  };
  window.addEventListener('online', handleFocusOrOnline);
  window.addEventListener('focus', handleFocusOrOnline);

  return () => {
    isClosedIntentionally = true;
    window.removeEventListener('online', handleFocusOrOnline);
    window.removeEventListener('focus', handleFocusOrOnline);
    stopHealthPolling();
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Unmounted');
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try {
              ws?.close(1000, 'Unmounted');
            } catch {}
          };
          ws.close();
        }
      } catch {}
    }
  };
}
