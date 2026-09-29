import { fetchSettingsSection, updateSettingsSection, fetchSystemInfo } from './api';
import { setDateFormat } from './dateFormatService';

const SETTINGS_CACHE_PREFIX = 'huhtamaki_settings_';

const inMemorySections: Record<string, any> = {};
let cachedSystemInfo: any = null;

// Initial fallbacks to ensure 0ms instantaneous render with zero empty states
const DEFAULT_SECTION_VALUES: Record<string, any> = {
  general: {
    machine_id: 'HUH-INSP-01',
    plant_name: 'Huhtamaki Silvassa Plant 2',
    line_number: 'Line 04 - High Speed Thermoforming',
    date_format: 'DD/MM/YYYY',
    auto_save_interval_sec: 30,
    inspection_tolerance_mm: 0.25,
    min_confidence_threshold: 85,
  },
  advance_plc: {
    enable_plc: true,
    protocol: 'Modbus TCP',
    plc_host: '192.168.125.1',
    tcp_port: '502',
    socket_timeout: '5',
    retry_count: '3',
    poll_interval: '100',
    unit_id: '1',
    start_address: '0',
  },
  advance_network: {
    system_ip: '192.168.1.150',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.1.1',
    dns_server: '8.8.8.8',
    scanner_ip: '192.168.125.20',
    sensor_ip: '192.168.125.21',
    rejector_ip: '192.168.125.22',
  },
  advance_alerts: {
    enable_inspection_alerts: true,
    trigger_timeout: '300',
    missed_trigger_threshold: '3',
    jitter_tolerance: '15',
    processing_overrun: '250',
    queue_depth: '50',
    alert_action: 'Stop Production Line',
    tower_light_alert: true,
    buzzer_alert: false,
    plc_signal_fault: true,
  },
  advance_processing: {
    processing_mode: 'sync',
    worker_threads: '4',
    gpu_acceleration: true,
    confidence_threshold: '85',
  },
  advance_cache: {
    frame_cache_size: '200',
    result_cache_size: '10000',
    max_ram_mb: '2048',
    cache_eviction: 'FIFO',
    flush_on_preset_change: true,
  },
  advance_debug: {
    enable_debug_logs: false,
    dump_modbus_packets: false,
    save_raw_frames: false,
    simulate_hardware: false,
  },
};

/**
 * Synchronously retrieves a settings section from memory or localStorage.
 * Guarantees 0ms immediate response.
 */
export function getCachedSection<T = any>(sectionName: string): T {
  if (inMemorySections[sectionName]) {
    return inMemorySections[sectionName] as T;
  }

  try {
    const raw = localStorage.getItem(`${SETTINGS_CACHE_PREFIX}${sectionName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      inMemorySections[sectionName] = parsed;
      if (sectionName === 'general' && parsed.date_format) {
        setDateFormat(parsed.date_format);
      }
      return parsed as T;
    }
  } catch (e) {
    console.warn(`Failed reading cached settings section ${sectionName}:`, e);
  }

  const fallback = DEFAULT_SECTION_VALUES[sectionName] || {};
  inMemorySections[sectionName] = fallback;
  return fallback as T;
}

/**
 * Saves section immediately to memory and localStorage, and synchronizes with backend.
 */
export async function saveSectionSettings(sectionName: string, settings: Record<string, any>): Promise<any> {
  const current = getCachedSection(sectionName) || {};
  const merged = { ...current, ...settings };
  inMemorySections[sectionName] = merged;

  try {
    localStorage.setItem(`${SETTINGS_CACHE_PREFIX}${sectionName}`, JSON.stringify(merged));
  } catch (e) {
    console.warn(`Failed saving settings section ${sectionName} to localStorage:`, e);
  }

  if (sectionName === 'general' && settings.date_format) {
    setDateFormat(settings.date_format);
  }

  try {
    return await updateSettingsSection(sectionName, settings);
  } catch (err) {
    console.warn(`Could not sync section ${sectionName} to backend:`, err);
    return merged;
  }
}

/**
 * Quietly syncs section from backend without blocking UI.
 */
export async function syncSectionFromBackend(sectionName: string): Promise<any> {
  try {
    const data = await fetchSettingsSection(sectionName);
    if (data && Object.keys(data).length > 0) {
      const current = inMemorySections[sectionName] || {};
      const merged = { ...current, ...data };
      inMemorySections[sectionName] = merged;
      localStorage.setItem(`${SETTINGS_CACHE_PREFIX}${sectionName}`, JSON.stringify(merged));
      if (sectionName === 'general' && data.date_format) {
        setDateFormat(data.date_format);
      }
      return merged;
    }
  } catch (err) {
    // Keep cached version silently
  }
  return getCachedSection(sectionName);
}

/**
 * Synchronously retrieves cached system info.
 */
export function getCachedSystemInfo(): any {
  if (cachedSystemInfo) return cachedSystemInfo;
  try {
    const raw = localStorage.getItem(`${SETTINGS_CACHE_PREFIX}system_info`);
    if (raw) {
      cachedSystemInfo = JSON.parse(raw);
      return cachedSystemInfo;
    }
  } catch {}
  return null;
}

/**
 * Preloads all settings sections and real system hardware data on application startup.
 */
export async function preloadAllSettings() {
  // Pre-load general and sync date format immediately
  getCachedSection('general');

  // Background fetch all sections in parallel
  const sections = ['general', 'advance_plc', 'advance_network', 'advance_alerts', 'advance_processing', 'advance_cache', 'advance_debug'];
  Promise.allSettled(sections.map((s) => syncSectionFromBackend(s))).catch(() => {});

  // Fetch real system info
  try {
    const sysInfo = await fetchSystemInfo();
    if (sysInfo) {
      cachedSystemInfo = sysInfo;
      localStorage.setItem(`${SETTINGS_CACHE_PREFIX}system_info`, JSON.stringify(sysInfo));
    }
  } catch {}
}
