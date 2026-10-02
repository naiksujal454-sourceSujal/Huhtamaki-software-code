import React, { useState, useEffect, useRef } from 'react';
import { fetchAuditLogs, type AuditEventItem } from '../../services/api';
import { auditLogger } from '../../services/auditLogger';
import type { InspectionEvent } from '../../services/inspectionService';
import { Activity, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDateTime, subscribeToDateFormat } from '../../services/dateFormatService';

interface EventLogsProps {
  isRunning: boolean;
  recentEvents?: InspectionEvent[];
  lastEvent?: InspectionEvent | null;
}

interface FormattedLog {
  sn: number;
  time: string;
  event: string;
  desc: string;
  actor: string;
  fail?: boolean;
  active?: boolean;
}

const EventLogs: React.FC<EventLogsProps> = ({ isRunning, recentEvents = [], lastEvent = null }) => {
  const [activeTab, setActiveTab] = useState<'scans' | 'audit'>('scans');
  const [logs, setLogs] = useState<FormattedLog[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-switch to live scans when inspection starts running
  useEffect(() => {
    if (isRunning) {
      setActiveTab('scans');
    }
  }, [isRunning]);

  const formatEventName = (action: string, details?: Record<string, any>): string => {
    if (details?.event_name) return details.event_name;
    if (details?.tab) return details.tab === 'UI' ? 'UI Settings' : details.tab;
    if (action.startsWith('home') || details?.to_view === 'inspection') return 'Home';
    if (action.startsWith('analytics') || details?.to_view === 'analytics') return 'Analytics';
    if (action.startsWith('connections') || details?.to_view === 'connections') return 'Connections';
    if (action === 'settings.view' || details?.to_view === 'settings') return 'Settings';
    if (action === 'auth.login') return 'Login';
    if (action === 'auth.logout') return 'Logout';
    if (action.startsWith('security.')) return 'Security';
    if (action.startsWith('settings.')) {
      const sub = action.replace('settings.', '');
      return sub.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
    if (action.includes('.')) {
      const parts = action.split('.');
      return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  const formatTimestamp = (dateStr: string): string => {
    return formatDateTime(dateStr, true);
  };

  const convertItem = (item: AuditEventItem, index: number, total: number): FormattedLog => {
    const isFailed = item.action.includes('fail') || (item.details && item.details.status === 'NOT_OK');
    const desc =
      item.details && (item.details.description || item.details.reason)
        ? item.details.description || item.details.reason
        : `${item.action} executed`;

    return {
      sn: total - index,
      time: formatTimestamp(item.created_at),
      event: formatEventName(item.action, item.details),
      desc: desc,
      actor: item.actor_username || 'system',
      fail: isFailed,
    };
  };

  const loadLogs = async () => {
    try {
      const data = await fetchAuditLogs(40);
      if (data && data.length > 0) {
        const total = data.length;
        const formatted = data.map((item, idx) => convertItem(item, idx, total));
        setLogs(formatted);
      }
    } catch (err) {
      console.warn('Could not fetch audit logs from backend:', err);
    }
  };

  useEffect(() => {
    loadLogs();

    const unsubscribe = auditLogger.subscribe((newEvent) => {
      setLogs((prev) => {
        const formatted = convertItem(newEvent, 0, prev.length + 1);
        formatted.active = true;
        return [formatted, ...prev.slice(0, 39)];
      });
    });

    const interval = setInterval(() => {
      loadLogs();
    }, 4000);

    const unsubFmt = subscribeToDateFormat(() => {
      loadLogs();
    });

    return () => {
      unsubscribe();
      unsubFmt();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-none overflow-hidden">
      {/* Sub-Header Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('scans')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'scans'
                ? 'bg-[#183b80] text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200'
            }`}
          >
            <Activity size={12} />
            <span>Live Scans {recentEvents.length > 0 ? `(${recentEvents.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#183b80] text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck size={12} />
            <span>Audit Trail</span>
          </button>
        </div>

        <div className="text-[11px] text-gray-500 font-mono">
          {activeTab === 'scans' ? (
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
              <span>{isRunning ? 'Realtime Stream' : 'Standby'}</span>
            </span>
          ) : (
            <span>Audit Logs</span>
          )}
        </div>
      </div>

      {/* Tab 1: Real-time Inspection Stream Table */}
      {activeTab === 'scans' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="flex text-[11px] font-bold text-gray-500 px-3 py-1.5 border-b border-gray-200 bg-slate-50 shrink-0">
            <div className="w-[8%]">S/N</div>
            <div className="w-[28%] pr-3">Timestamp</div>
            <div className="w-[13%]">Status</div>
            <div className="w-[25%]">Scanned Code</div>
            <div className="w-[12%] text-right">Latency</div>
            <div className="w-[14%] text-right">Confidence</div>
          </div>

          {/* Table Body */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-gray-100"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#94a3b8 #f8fafc',
            }}
          >
            {recentEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                {isRunning
                  ? 'Streaming live inspection scans...'
                  : 'No active inspection scans. Click Start to begin verification.'}
              </div>
            ) : (
              recentEvents.map((ev, idx) => {
                const isOk = ev.status === 'OK';
                return (
                  <div
                    key={`${ev.id}-${ev.inspected_at || ''}-${idx}`}
                    className={`flex items-center text-xs px-3 py-1.5 transition-colors ${
                      idx === 0
                        ? isOk
                          ? 'bg-emerald-50/70 font-semibold'
                          : 'bg-red-50/80 font-bold'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-[8%] font-mono font-bold text-gray-700">#{ev.id}</div>
                    <div className="w-[28%] pr-3 text-gray-600 font-mono text-[11px] whitespace-nowrap">
                      {ev.inspected_at ? formatDateTime(ev.inspected_at, true) : 'Just now'}
                    </div>
                    <div className="w-[13%]">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          isOk
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                        }`}
                      >
                        {isOk ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                        <span>{ev.status}</span>
                      </span>
                    </div>
                    <div className="w-[25%] font-mono text-[11px] truncate" title={ev.scanned_code}>
                      <span className={isOk ? 'text-gray-800 font-semibold' : 'text-red-600 font-extrabold'}>
                        {ev.scanned_code || 'UNREAD'}
                      </span>
                    </div>
                    <div className="w-[12%] text-right font-mono text-[11px] text-gray-600 font-semibold">
                      {ev.latency_ms}ms
                    </div>
                    <div className="w-[14%] text-right font-mono text-[11px] text-gray-500">
                      {ev.confidence ? `${ev.confidence}%` : '99.8%'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Tab 2: System Audit Trail Table */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="flex text-[11px] font-bold text-gray-500 px-3 py-1.5 border-b border-gray-200 bg-slate-50 shrink-0">
            <div className="w-[8%]">S/N</div>
            <div className="w-[24%]">Timestamp</div>
            <div className="w-[22%]">Action</div>
            <div className="w-[16%]">User</div>
            <div className="w-[30%]">Description</div>
          </div>

          {/* Table Body */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden divide-y divide-gray-100"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#94a3b8 #f8fafc',
            }}
          >
            {logs.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">Loading audit trail...</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex items-start text-xs px-3 py-1.5 transition-colors ${
                    log.active ? 'bg-blue-50/70 font-semibold' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-[8%] font-bold text-gray-700">{log.sn}</div>
                  <div className="w-[24%] text-gray-600 font-mono text-[11px] whitespace-nowrap">{log.time}</div>
                  <div className="w-[22%] pr-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide truncate max-w-full ${
                        log.fail ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-[#153472]'
                      }`}
                    >
                      {log.event}
                    </span>
                  </div>
                  <div className="w-[16%] text-gray-700 font-medium text-[11px] truncate">{log.actor}</div>
                  <div
                    className={`w-[30%] whitespace-pre-line text-[11px] leading-snug break-words ${
                      log.fail ? 'text-red-600 font-bold' : 'text-gray-700'
                    }`}
                  >
                    {log.desc}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventLogs;
