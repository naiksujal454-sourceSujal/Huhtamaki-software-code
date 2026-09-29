import React, { useState, useEffect, useRef } from 'react';
import {
  fetchAppLogs,
  fetchConfigLogs,
  fetchAuditTrailLogs,
  type AppLogItem,
  type ConfigLogItem,
  type AuditTrailItem,
} from '../../../services/api';
import { auditLogger } from '../../../services/auditLogger';
import {
  Terminal,
  Search,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ArrowDownCircle,
  FileText,
  SlidersHorizontal,
  Activity,
  Layers,
} from 'lucide-react';

type LogTabType = 'app' | 'config' | 'event';

const LogsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LogTabType>('app');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appLogLevel, setAppLogLevel] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  // Raw datasets from backend
  const [appLogs, setAppLogs] = useState<AppLogItem[]>([]);
  const [configLogs, setConfigLogs] = useState<ConfigLogItem[]>([]);
  const [eventLogs, setEventLogs] = useState<AuditTrailItem[]>([]);

  // Cleared states for each terminal tab
  const [clearedTabs, setClearedTabs] = useState<Record<LogTabType, boolean>>({
    app: false,
    config: false,
    event: false,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch active log dataset from backend
  const loadData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      if (activeTab === 'app') {
        const data = await fetchAppLogs(250, appLogLevel !== 'ALL' ? appLogLevel : undefined, searchQuery || undefined);
        setAppLogs(data);
      } else if (activeTab === 'config') {
        const data = await fetchConfigLogs(250, searchQuery || undefined);
        setConfigLogs(data);
      } else if (activeTab === 'event') {
        const data = await fetchAuditTrailLogs(250, searchQuery || undefined);
        setEventLogs(data);
      }
    } catch (err) {
      console.error(`Failed to load ${activeTab} logs:`, err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    setClearedTabs((prev) => ({ ...prev, [activeTab]: false }));
  }, [activeTab, appLogLevel]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Live polling every 3 seconds for continuous live stream in terminal
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTab, appLogLevel, searchQuery]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [appLogs, configLogs, eventLogs, autoScroll, clearedTabs]);

  const handleClearTerminal = () => {
    setClearedTabs((prev) => ({ ...prev, [activeTab]: true }));
  };

  const handleCopyLogs = () => {
    let text = '';
    if (activeTab === 'app') {
      text = appLogs.map((l) => l.formatted || `[${l.timestamp}] [${l.level}] ${l.logger}: ${l.message}`).join('\n');
    } else if (activeTab === 'config') {
      text = configLogs.map((l) => l.formatted || `[${l.timestamp}] [CONFIG] @${l.actor}: ${l.action} - ${l.description}`).join('\n');
    } else if (activeTab === 'event') {
      text = eventLogs.map((l) => l.formatted || `[${l.timestamp}] [EVENT] @${l.actor} [${l.role}] ${l.action} - ${l.description}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render raw terminal log lines
  const renderLogLines = () => {
    if (clearedTabs[activeTab]) {
      return (
        <div className="py-6 text-gray-500 font-mono text-xs italic">
          Terminal screen cleared. Waiting for new streaming events...
        </div>
      );
    }

    if (activeTab === 'app') {
      if (appLogs.length === 0) {
        return (
          <div className="py-6 text-gray-500 font-mono text-xs italic">
            {loading ? 'Connecting to application log stream...' : 'No application logs recorded.'}
          </div>
        );
      }
      return appLogs.map((log) => {
        const lvl = (log.level || 'INFO').toUpperCase();
        const lvlColor =
          lvl === 'ERROR' || lvl === 'CRITICAL'
            ? 'text-red-400 font-bold'
            : lvl === 'WARNING' || lvl === 'WARN'
            ? 'text-amber-400 font-bold'
            : lvl === 'DEBUG'
            ? 'text-gray-400'
            : 'text-emerald-400 font-bold';

        return (
          <div key={log.id} className="py-0.5 hover:bg-[#161b22] px-2 rounded font-mono text-xs leading-relaxed flex items-start gap-2">
            <span className="text-gray-500 select-none shrink-0">{log.timestamp}</span>
            <span className={`shrink-0 w-16 text-center ${lvlColor}`}>[{lvl}]</span>
            <span className="text-cyan-400 shrink-0 font-medium">[{log.logger}]</span>
            <span className="text-gray-200 break-all">{log.message}</span>
          </div>
        );
      });
    }

    if (activeTab === 'config') {
      if (configLogs.length === 0) {
        return (
          <div className="py-6 text-gray-500 font-mono text-xs italic">
            {loading ? 'Fetching configuration modification stream...' : 'No configuration logs recorded.'}
          </div>
        );
      }
      return configLogs.map((log) => (
        <div key={log.id} className="py-0.5 hover:bg-[#161b22] px-2 rounded font-mono text-xs leading-relaxed flex items-start gap-2">
          <span className="text-gray-500 select-none shrink-0">{log.timestamp}</span>
          <span className="text-blue-400 font-bold shrink-0 w-20 text-center">[CONFIG]</span>
          <span className="text-purple-400 shrink-0 font-medium">[@{log.actor}]</span>
          <span className="text-amber-300 shrink-0 font-semibold">{log.action}:</span>
          <span className="text-gray-300 break-all">{log.description || JSON.stringify(log.details)}</span>
        </div>
      ));
    }

    if (activeTab === 'event') {
      if (eventLogs.length === 0) {
        return (
          <div className="py-6 text-gray-500 font-mono text-xs italic">
            {loading ? 'Fetching system & audit event stream...' : 'No event or audit logs recorded.'}
          </div>
        );
      }
      return eventLogs.map((log) => {
        const actionStr = (log.action || '').toLowerCase();
        const isFail = actionStr.includes('fail') || actionStr.includes('defect') || actionStr.includes('error') || actionStr.includes('reject');
        const isPass = actionStr.includes('pass') || actionStr.includes('ok') || actionStr.includes('success');
        const isDelete = actionStr.includes('delete') || actionStr.includes('remove');

        const tagColor = isFail || isDelete
          ? 'text-red-400 font-bold'
          : isPass
          ? 'text-emerald-400 font-bold'
          : 'text-purple-400 font-bold';

        const detailText = log.description || (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || ''));

        return (
          <div key={log.id} className="py-0.5 hover:bg-[#161b22] px-2 rounded font-mono text-xs leading-relaxed flex items-start gap-2">
            <span className="text-gray-500 select-none shrink-0">{log.timestamp}</span>
            <span className={`shrink-0 w-28 text-center ${tagColor}`}>[EVENT/AUDIT]</span>
            <span className="text-teal-400 shrink-0 font-medium">[@{log.actor}]</span>
            {log.role && <span className="text-gray-500 shrink-0">({log.role})</span>}
            <span className="text-slate-400 shrink-0">[{log.ip_address || '127.0.0.1'}]</span>
            <span className="text-blue-400 shrink-0">[{log.entity}]</span>
            <span className="text-yellow-300 shrink-0 font-semibold">{log.action}:</span>
            <span className="text-gray-300 break-all">{detailText}</span>
          </div>
        );
      });
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col max-w-6xl pb-4">
      
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#153472] flex items-center gap-2">
          <Terminal size={22} className="text-[#153472]" />
          <span>System Terminal Logs</span>
        </h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Real-time industrial streaming terminal for application runtime, configuration history, and inspection events.
        </p>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden shadow-2xl min-h-[580px]">
        
        {/* Top Terminal Bar (Antigravity IDE / VS Code Style) */}
        <div className="h-11 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-3 shrink-0">
          
          {/* Tabs: Exactly 3 Logs (App Logs, Config Logs, Event Logs) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('app')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'app'
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]/50'
              }`}
            >
              <Terminal size={14} className={activeTab === 'app' ? 'text-emerald-400' : ''} />
              <span>App Logs</span>
              <span className="text-[10px] bg-[#30363d] text-gray-300 px-1.5 py-0.2 rounded-full">
                {appLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'config'
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]/50'
              }`}
            >
              <Layers size={14} className={activeTab === 'config' ? 'text-blue-400' : ''} />
              <span>Config Logs</span>
              <span className="text-[10px] bg-[#30363d] text-gray-300 px-1.5 py-0.2 rounded-full">
                {configLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('event')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'event'
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]/50'
              }`}
            >
              <Activity size={14} className={activeTab === 'event' ? 'text-purple-400' : ''} />
              <span>Event Logs</span>
              <span className="text-[10px] bg-[#30363d] text-gray-300 px-1.5 py-0.2 rounded-full">
                {eventLogs.length}
              </span>
            </button>
          </div>

          {/* Right Controls: Filter, Search, Clear, Copy, Auto-scroll */}
          <div className="flex items-center gap-2">
            
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Filter terminal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0d1117] border border-[#30363d] rounded text-gray-200 text-xs font-mono pl-7 pr-2.5 py-1 w-44 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Level Filter (for App Logs) */}
            {activeTab === 'app' && (
              <select
                value={appLogLevel}
                onChange={(e) => setAppLogLevel(e.target.value)}
                className="bg-[#0d1117] border border-[#30363d] rounded text-gray-200 text-xs font-mono px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">ALL LEVELS</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>
            )}

            {/* Auto-scroll Button */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Auto-scroll enabled (click to lock)' : 'Auto-scroll disabled'}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                autoScroll ? 'text-emerald-400 bg-[#21262d]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <ArrowDownCircle size={15} />
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              title="Refresh Stream"
              className="p-1.5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopyLogs}
              title="Copy Output"
              className="p-1.5 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>

            {/* Clear Terminal Button */}
            <button
              onClick={handleClearTerminal}
              title="Clear Terminal Output"
              className="p-1.5 rounded text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Terminal Header Prompt */}
        <div className="bg-[#0d1117] px-4 py-2 border-b border-[#21262d] text-gray-400 font-mono text-[11px] flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">$</span>
            <span className="text-gray-300">huhtamaki-vision --stream={activeTab}-logs</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">buffer: 250 records</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-400 uppercase text-[10px] font-bold tracking-wider">LIVE</span>
          </div>
        </div>

        {/* Terminal Output Body - Monospace, purely logs */}
        <div
          ref={scrollRef}
          className="flex-1 p-3 overflow-y-auto font-mono text-xs select-text space-y-0.5 scrollbar-thin scrollbar-thumb-[#30363d] scrollbar-track-transparent"
        >
          {renderLogLines()}
        </div>
      </div>
    </div>
  );
};

export default LogsTab;
