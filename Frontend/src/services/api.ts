// API client for Huhtamaki Inspection System

export interface User {
  id: number | string;
  public_uuid?: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

export interface AuditEventItem {
  id: number;
  actor_user_id: string | null;
  actor_username: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

import { API_BASE_URL } from './apiConfig';

const API_BASE = `${API_BASE_URL}/api`;
const TOKEN_KEY = 'huhtamaki_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Session-Token'] = token;
  }
  return headers;
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const customHeaders = (options.headers as Record<string, string>) || {};
  const headers = getAuthHeaders(customHeaders);
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export async function loginUser(username: string, password: string): Promise<{ user: User; expires_at: string; token?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await authFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let errorDetail = 'Login failed';
      try {
        const data = await res.json();
        errorDetail = data.detail || data.message || errorDetail;
      } catch {
        // ignore
      }
      throw new Error(errorDetail);
    }

    const result = await res.json();
    if (result.token) {
      setAuthToken(result.token);
    }
    return result;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please ensure the backend server is running on port 8000.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await authFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
    });
  } finally {
    setAuthToken(null);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await authFetch(`${API_BASE}/auth/me`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchUsers(): Promise<User[]> {
  const res = await authFetch(`${API_BASE}/users`, {
    method: 'GET',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch users');
  }
  return await res.json();
}

export async function changeUserPassword(
  userId: number | string,
  payload: { current_password: string; new_password: string; username?: string }
): Promise<{ status: string; message: string }> {
  const res = await authFetch(`${API_BASE}/users/${userId}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorMsg = 'Failed to change password';
    try {
      const data = await res.json();
      errorMsg = data.detail || data.message || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return await res.json();
}

export async function toggleUserActive(
  userId: number | string,
  isActive?: boolean
): Promise<{ status: string; is_active: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/users/${userId}/toggle-active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(isActive !== undefined ? { is_active: isActive } : {}),
  });

  if (!res.ok) {
    throw new Error('Failed to toggle user status');
  }

  return await res.json();
}

export async function deleteUser(
  userId: number | string
): Promise<{ status: string; message: string }> {
  const res = await authFetch(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    let errorMsg = 'Failed to delete user';
    try {
      const data = await res.json();
      errorMsg = data.detail || data.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return await res.json();
}

export async function fetchAuditLogs(limit: number = 100, action?: string): Promise<AuditEventItem[]> {
  const query = new URLSearchParams();
  query.set('limit', limit.toString());
  if (action) query.set('action', action);

  const res = await authFetch(`${API_BASE}/system/audit-logs?${query.toString()}`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch audit logs');
  }

  return await res.json();
}

// ----------------------------------------------------
// SETTINGS & DIAGNOSTICS API
// ----------------------------------------------------

export async function fetchSettingsSection(section: string): Promise<Record<string, any>> {
  const res = await authFetch(`${API_BASE}/settings/section/${section}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`Failed to load ${section} settings`);
  return await res.json();
}

export async function updateSettingsSection(
  section: string,
  settings: Record<string, any>
): Promise<Record<string, any>> {
  const res = await authFetch(`${API_BASE}/settings/section/${section}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error(`Failed to save ${section} settings`);
  return await res.json();
}

export async function fetchAlertConfigurations(): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/settings/alerts`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to load alert configurations');
  return await res.json();
}

export async function updateAlertConfigurations(alerts: any[]): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/settings/alerts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alerts }),
  });
  if (!res.ok) throw new Error('Failed to update alert configurations');
  return await res.json();
}

export async function fetchServiceDetail(): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/service-detail`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to load service detail');
  return await res.json();
}

export async function updateServiceDetail(data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/service-detail`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update service detail');
  return await res.json();
}

export async function fetchRolePrivileges(role: string = 'operator'): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/settings/privileges?role=${encodeURIComponent(role)}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`Failed to load privileges for ${role}`);
  return await res.json();
}

export async function updateRolePrivileges(role: string, privileges: any[]): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/settings/privileges`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, privileges }),
  });
  if (!res.ok) throw new Error(`Failed to update privileges for ${role}`);
  return await res.json();
}

export async function fetchMyPrivileges(): Promise<Record<string, boolean>> {
  try {
    const res = await authFetch(`${API_BASE}/settings/privileges/my-privileges`, {
      method: 'GET',
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchSystemInfo(): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/system-info`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch system info');
  return await res.json();
}

export async function fetchNetworkInterfaces(): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/network/interfaces`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch network interfaces');
  return await res.json();
}

export async function runPingTest(target: string): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/network/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error('Ping request failed');
  return await res.json();
}

export async function scanWifiNetworks(): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/settings/network/wifi-scan`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Wi-Fi scan failed');
  return await res.json();
}

export async function runComponentTest(component: string = 'all'): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/test/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ component }),
  });
  if (!res.ok) throw new Error('Component test failed');
  return await res.json();
}

export const runDiagnosticTest = runComponentTest;

export async function postAuditEvent(
  action: string,
  details: Record<string, any> = {},
  entityType?: string,
  entityId?: string
): Promise<AuditEventItem> {
  const res = await authFetch(`${API_BASE}/system/audit-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to post audit event');
  }

  return await res.json();
}

export async function fetchEmailSettings(): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/email`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch email settings');
  return await res.json();
}

export async function updateEmailSettings(data: any): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/email`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update email settings');
  return await res.json();
}

export async function sendTestEmail(recipientEmail: string): Promise<any> {
  const res = await authFetch(`${API_BASE}/settings/email/send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_email: recipientEmail }),
  });
  if (!res.ok) throw new Error('Failed to send test email');
  return await res.json();
}

export interface TrendPoint {
  date: string;
  total: number;
  passed: number;
  failed: number;
}

export interface FailureReasonItem {
  reason: string;
  count: number;
}

export interface ProductionBatchInfo {
  batch_code: string | null;
  status: 'OPEN' | 'CLOSED';
  opened_at?: string | null;
  total: number;
  passed: number;
  failed: number;
}

export interface PipelineHealthInfo {
  queue_depth: number;
  queue_age_seconds: number;
  ws_clients: number;
  audit_db_write_ok_total: number;
}

export interface BatchHistoryItem {
  code: string;
  status: string;
  pass_count: number;
  fail_count: number;
  total_count: number;
  opened_at?: string | null;
  opened_formatted?: string | null;
}

export interface DashboardSummaryData {
  from_date: string | null;
  to_date: string | null;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  average_processing_ms: number | null;
  with_print_verification: number;
  print_pass: number;
  print_fail: number;
  without_print_verification: number;
  defect_breakdown: FailureReasonItem[];
  top_failure_reasons: FailureReasonItem[];
  trend: TrendPoint[];
  recent_results: Array<{
    id: number;
    time: string;
    preset: string;
    image: string;
    status: string;
    ms: number;
    batch_code: string;
    scanned_code?: string;
    expected_code?: string;
    reason?: string;
  }>;
  production_batch?: ProductionBatchInfo | null;
  pipeline_health?: PipelineHealthInfo | null;
  batch_history?: BatchHistoryItem[];
  generated_at: string;
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryData> {
  const res = await authFetch(`${API_BASE}/dashboard/summary`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  return await res.json();
}

export async function openProductionBatch(batchCode: string): Promise<ProductionBatchInfo> {
  const res = await authFetch(`${API_BASE}/dashboard/batch/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_code: batchCode }),
  });
  if (!res.ok) throw new Error('Failed to open production batch');
  return await res.json();
}

export async function closeProductionBatch(): Promise<ProductionBatchInfo> {
  const res = await authFetch(`${API_BASE}/dashboard/batch/close`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to close production batch');
  return await res.json();
}

export async function downloadInspectionsCSV(targetDate?: string): Promise<{ blob: Blob; filename: string; count: number; text: string }> {
  const url = targetDate 
    ? `${API_BASE}/inspections/export-csv?target_date=${encodeURIComponent(targetDate)}`
    : `${API_BASE}/inspections/export-csv`;
  const res = await authFetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to export inspections CSV');
  const countHeader = res.headers.get('X-Record-Count');
  const count = countHeader ? parseInt(countHeader, 10) : 0;
  const disp = res.headers.get('Content-Disposition') || '';
  const match = disp.match(/filename=(.+)/);
  const filename = match ? match[1].replace(/["']/g, '') : `inspections_${new Date().toISOString().slice(0, 10)}.csv`;
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  return { blob, filename, count, text };
}

export interface AppLogItem {
  id: string;
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  file?: string;
  formatted: string;
}

export interface ConfigLogItem {
  id: number;
  timestamp: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  ip_address: string;
  details: Record<string, any>;
  description: string;
  formatted: string;
}

export async function fetchAppLogs(limit = 150, level?: string, search?: string): Promise<AppLogItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (level && level !== 'ALL') params.set('level', level);
  if (search) params.set('search', search);

  const res = await authFetch(`${API_BASE}/system/app-logs?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch app logs');
  return await res.json();
}

export async function fetchConfigLogs(limit = 150, search?: string): Promise<ConfigLogItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (search) params.set('search', search);

  const res = await authFetch(`${API_BASE}/system/config-logs?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch config logs');
  return await res.json();
}

export interface AuditTrailItem {
  id: number;
  timestamp: string; // Kab (When)
  actor: string;     // Kon / Kisne (Who)
  role: string;
  entity: string;    // Kaha (Where)
  entity_id: string;
  ip_address: string;
  action: string;    // Kya (What)
  details: Record<string, any>;
  description: string;
  formatted: string;
}

export async function fetchAuditTrailLogs(limit = 150, search?: string): Promise<AuditTrailItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (search) params.set('search', search);

  const res = await authFetch(`${API_BASE}/system/audit-trail?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch audit trail logs');
  return await res.json();
}

export async function restartSystem(): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/system/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to initiate system restart');
  return await res.json();
}

export async function shutdownSystem(): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${API_BASE}/system/shutdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to initiate system shutdown');
  return await res.json();
}

export async function testPlcConnection(
  host: string,
  port: number = 502,
  timeout: number = 2.0,
  unitId: number = 1
): Promise<{ success: boolean; connected: boolean; latency_ms: number; message: string }> {
  const res = await authFetch(`${API_BASE}/system/plc-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, timeout, unit_id: unitId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'PLC test failed');
  }
  return await res.json();
}

export async function runPing(target: string = '8.8.8.8'): Promise<{ target: string; reachable: boolean; latency_ms: number | null; output: string }> {
  const res = await authFetch(`${API_BASE}/settings/network/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) {
    return { target, reachable: false, latency_ms: null, output: 'Ping request failed' };
  }
  return await res.json();
}

// ==========================================
// Datalogic Matrix 220 Hardware APIs
// ==========================================

export interface DatalogicConfigPayload {
  exposure_us?: number;
  gain?: number;
  focus_distance_mm?: number;
  internal_illuminator?: string;
  trigger_mode?: string;
  job_id?: number;
  rated_speed_mpm?: number;
  ip?: string;
  port?: number;
}

export async function getDatalogicStatus(ip?: string, port?: number) {
  const query = ip ? `?ip=${encodeURIComponent(ip)}${port ? `&port=${port}` : ''}` : '';
  const res = await authFetch(`${API_BASE}/datalogic/status${query}`);
  if (!res.ok) throw new Error('Failed to fetch Datalogic status');
  return await res.json();
}

export async function pingDatalogic(ip?: string, port?: number) {
  const query = ip ? `?ip=${encodeURIComponent(ip)}${port ? `&port=${port}` : ''}` : '';
  const res = await authFetch(`${API_BASE}/datalogic/ping${query}`);
  if (!res.ok) throw new Error('Failed to ping Datalogic Matrix 220');
  return await res.json();
}

export async function configureDatalogic(payload: DatalogicConfigPayload) {
  const res = await authFetch(`${API_BASE}/datalogic/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to configure Datalogic Matrix 220');
  return await res.json();
}

export async function triggerDatalogicScan(ip?: string, port?: number) {
  const res = await authFetch(`${API_BASE}/datalogic/trigger-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, port }),
  });
  if (!res.ok) throw new Error('Failed to trigger scan on Datalogic Matrix 220');
  return await res.json();
}

export async function selectDatalogicJob(jobId: number, ip?: string, port?: number) {
  const res = await authFetch(`${API_BASE}/datalogic/select-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, ip, port }),
  });
  if (!res.ok) throw new Error('Failed to switch Datalogic job');
  return await res.json();
}


