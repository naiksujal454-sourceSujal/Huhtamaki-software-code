// Global Date Formatting Service for Huhtamaki Vision Inspection System
// Supports 'DD/MM/YYYY', 'MM/DD/YYYY', and 'YYYY-MM-DD' across the entire application.

export type DateFormatPattern = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

const DATE_FORMAT_KEY = 'huhtamaki_date_format';
let currentFormat: DateFormatPattern = (localStorage.getItem(DATE_FORMAT_KEY) as DateFormatPattern) || 'DD/MM/YYYY';

const listeners = new Set<(fmt: DateFormatPattern) => void>();

export function getDateFormat(): DateFormatPattern {
  return currentFormat;
}

export function setDateFormat(newFormat: DateFormatPattern | string) {
  const validFormat: DateFormatPattern =
    newFormat === 'MM/DD/YYYY' || newFormat === 'YYYY-MM-DD' ? newFormat : 'DD/MM/YYYY';

  currentFormat = validFormat;
  try {
    localStorage.setItem(DATE_FORMAT_KEY, validFormat);
  } catch (e) {
    console.warn('Could not store date format in localStorage:', e);
  }

  // Notify all subscribing React components across the software
  listeners.forEach((cb) => {
    try {
      cb(validFormat);
    } catch (err) {
      console.error('Error notifying date format subscriber:', err);
    }
  });

  // Also dispatch window custom event for non-React contexts
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('huhtamaki:date_format_changed', { detail: validFormat }));
  }
}

export function subscribeToDateFormat(cb: (fmt: DateFormatPattern) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Formats a Date object or ISO date string according to the globally configured date format.
 * Example:
 *   DD/MM/YYYY -> 28/09/2026
 *   MM/DD/YYYY -> 09/28/2026
 *   YYYY-MM-DD -> 2026-09-28
 */
export function formatDate(dateInput: Date | string | number | null | undefined, customFormat?: DateFormatPattern): string {
  if (!dateInput) return '';

  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string' && dateInput.includes(' ') && !dateInput.includes('T')) {
    // Handle SQL format "YYYY-MM-DD HH:mm:ss"
    d = new Date(dateInput.replace(' ', 'T'));
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) {
    // If parsing fails, try regex extraction of year, month, day
    if (typeof dateInput === 'string') {
      const match = dateInput.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        const fmt = customFormat || currentFormat;
        if (fmt === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
        if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
        return `${year}-${month}-${day}`;
      }
    }
    return String(dateInput);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());

  const fmt = customFormat || currentFormat;
  if (fmt === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
  if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp with both date and time according to the configured format.
 * E.g.: "28/09/2026 10:00:45" or with ms: "28/09/2026 10:00:45.364"
 */
export function formatDateTime(
  dateInput: Date | string | number | null | undefined,
  includeMs: boolean = false,
  customFormat?: DateFormatPattern
): string {
  if (!dateInput) return '';

  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string' && dateInput.includes(' ') && !dateInput.includes('T')) {
    d = new Date(dateInput.replace(' ', 'T'));
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) {
    // If it's already a formatted string like "2026-09-28 10:00:45.364", parse date & time components
    if (typeof dateInput === 'string') {
      const match = dateInput.match(/^(\d{4})[-/](\d{2})[-/](\d{2})\s+(\d{2}:\d{2}:\d{2}(\.\d+)?)/);
      if (match) {
        const [, year, month, day, timePart] = match;
        const fmt = customFormat || currentFormat;
        const formattedDate =
          fmt === 'DD/MM/YYYY' ? `${day}/${month}/${year}` : fmt === 'MM/DD/YYYY' ? `${month}/${day}/${year}` : `${year}-${month}-${day}`;
        return `${formattedDate} ${timePart}`;
      }
    }
    return String(dateInput);
  }

  const formattedDate = formatDate(d, customFormat);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  if (includeMs) {
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${formattedDate} ${timeStr}.${ms}`;
  }

  return `${formattedDate} ${timeStr}`;
}
