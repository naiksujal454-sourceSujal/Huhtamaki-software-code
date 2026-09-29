import React, { useState, useEffect } from 'react';
import { auditLogger } from '../../../services/auditLogger';
import { CheckCircle, AlertCircle, Loader2, RotateCcw, Power } from 'lucide-react';
import { restartSystem, shutdownSystem } from '../../../services/api';
import { getDateFormat, setDateFormat as setGlobalDateFormat } from '../../../services/dateFormatService';
import { getCachedSection, saveSectionSettings, syncSectionFromBackend } from '../../../services/settingsStore';

const GeneralSettingsTab: React.FC = () => {
  // Synchronous 0ms immediate initialization from cache
  const cached = getCachedSection('general');
  const [dateFormat, setDateFormatState] = useState<string>(() => getDateFormat() || cached.date_format || 'DD/MM/YYYY');
  const [savedMsg, setSavedMsg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [restartCountdown, setRestartCountdown] = useState<number>(3);

  // Background SWR sync
  useEffect(() => {
    syncSectionFromBackend('general').then((data) => {
      if (data && data.date_format) {
        setDateFormatState(data.date_format);
        setGlobalDateFormat(data.date_format);
      }
    });
  }, []);

  const handleDateFormatChange = (newVal: string) => {
    setDateFormatState(newVal);
    // Instantly update entire software in real-time
    setGlobalDateFormat(newVal);
    auditLogger.logAction('General Settings', 'settings.date_format_changed', `Changed global date format to ${newVal}`, {
      format: newVal,
    });
    // Auto-persist to store and backend
    saveSectionSettings('general', { date_format: newVal });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSectionSettings('general', {
        date_format: dateFormat,
      });

      auditLogger.logAction('General Settings', 'settings.general_saved', `Saved General Settings: Date Format ${dateFormat}`, {
        date_format: dateFormat,
      });

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err: any) {
      console.error('Failed to save general settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    const confirm = window.confirm('Are you sure you want to RESTART the Huhtamaki Vision Inspection System software?');
    if (!confirm) return;

    setIsRestarting(true);
    setActionMsg({ text: 'Initiating software restart...', type: 'warn' });

    try {
      await restartSystem();
      auditLogger.logAction('General Settings', 'settings.restart', 'Software restart executed', { action: 'restart' });

      let count = 3;
      setRestartCountdown(count);
      const timer = setInterval(() => {
        count -= 1;
        setRestartCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          window.location.reload();
        }
      }, 1000);
    } catch (err: any) {
      setIsRestarting(false);
      setActionMsg({ text: `Failed to restart software: ${err.message || 'Unknown error'}`, type: 'error' });
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleShutdown = async () => {
    const confirm = window.confirm('Are you sure you want to SHUTDOWN the inspection software? All active camera feeds and inspection services will stop.');
    if (!confirm) return;

    setIsShuttingDown(true);
    setActionMsg({ text: 'Shutting down software and closing active services...', type: 'warn' });

    try {
      await shutdownSystem();
      auditLogger.logAction('General Settings', 'settings.shutdown', 'Software shutdown executed', { action: 'shutdown' });

      setTimeout(() => {
        // Attempt desktop window close or show safe exit overlay
        if (typeof window !== 'undefined') {
          try {
            window.close();
          } catch {}
        }
      }, 1500);
    } catch (err: any) {
      setIsShuttingDown(false);
      setActionMsg({ text: `Failed to shutdown software: ${err.message || 'Unknown error'}`, type: 'error' });
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  if (isShuttingDown) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-8 select-none">
        <div className="w-16 h-16 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mb-6">
          <Power size={36} />
        </div>
        <h2 className="text-2xl font-black mb-2 tracking-wide">SYSTEM SHUTDOWN COMPLETE</h2>
        <p className="text-sm text-gray-400 max-w-md text-center mb-6">
          Huhtamaki Vision Inspection System has terminated all background processes and hardware connections safely.
        </p>
        <span className="text-xs font-mono text-gray-500 bg-slate-800 px-3 py-1.5 rounded">
          You may now safely close this window.
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl select-none">
      <h2 className="text-2xl font-bold text-[#153472] mb-1">General Settings</h2>
      <p className="text-xs text-gray-500 mb-6">Configure general application preferences, real-time date formatting, and system operations.</p>

      {savedMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          <span>General settings saved successfully. Global date format synchronized.</span>
        </div>
      )}

      {actionMsg && (
        <div className={`mb-4 p-3 border rounded-md text-xs font-bold flex items-center gap-2 ${
          actionMsg.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <AlertCircle size={16} />
          <span>{actionMsg.text}</span>
          {isRestarting && <span className="ml-auto font-mono text-xs">Reloading in {restartCountdown}s...</span>}
        </div>
      )}

      <div className="mb-6 bg-slate-50 border border-gray-200 rounded-lg p-5">
        <label className="block text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">
          Global Date Format
        </label>
        <select 
          value={dateFormat}
          onChange={(e) => handleDateFormatChange(e.target.value)}
          className="w-full max-w-[320px] bg-white border border-gray-300 rounded-md px-3.5 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-[#153472] shadow-xs cursor-pointer"
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 28/09/2026)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/28/2026)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-09-28)</option>
        </select>
        <p className="text-[11px] text-gray-500 mt-2 font-medium">
          Date format updates immediately in real-time across the live clock, inspection time, event logs, and all records.
        </p>
      </div>

      <div className="mb-8 bg-slate-50 border border-gray-200 rounded-lg p-5">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-1">System Actions</h3>
        <p className="text-[11px] text-gray-500 mb-4">Execute genuine hardware and software operating controls.</p>
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={handleRestart}
            disabled={isRestarting || isShuttingDown}
            className="bg-[#37b34a] hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-all text-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <RotateCcw size={14} className={isRestarting ? 'animate-spin' : ''} />
            <span>{isRestarting ? `Restarting (${restartCountdown}s)...` : 'Restart Software'}</span>
          </button>
          <button 
            type="button"
            onClick={handleShutdown}
            disabled={isRestarting || isShuttingDown}
            className="bg-[#da291c] hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-all text-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Power size={14} />
            <span>Shutdown Software</span>
          </button>
        </div>
      </div>

      <button 
        type="button"
        onClick={handleSave}
        disabled={saving || isRestarting}
        className="bg-[#153472] hover:bg-blue-900 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-all text-xs flex items-center gap-2 cursor-pointer active:scale-98"
      >
        {saving && <Loader2 className="animate-spin" size={14} />}
        <span>Save General Settings</span>
      </button>
    </div>
  );
};

export default GeneralSettingsTab;
