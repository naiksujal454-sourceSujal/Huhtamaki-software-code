import React, { useState } from 'react';
import { AlertTriangle, Bell, Play, VolumeX, Settings, X, ExternalLink } from 'lucide-react';
import type { AlarmDetails } from '../../services/inspectionService';

interface CriticalAlarmModalProps {
  alarm: AlarmDetails;
  onAcknowledge: () => Promise<void>;
  onResume: () => Promise<void>;
  onOpenAlertConfig?: () => void;
}

const CriticalAlarmModal: React.FC<CriticalAlarmModalProps> = ({ 
  alarm, 
  onAcknowledge, 
  onResume,
  onOpenAlertConfig 
}) => {
  const [isSilenced, setIsSilenced] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSilence = async () => {
    setIsProcessing(true);
    try {
      await onAcknowledge();
      setIsSilenced(true);
    } catch (err) {
      console.error('Failed to silence buzzer:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onResume();
    } catch (err) {
      console.error('Failed to accept defect and resume:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    /* Floating Compact Alert Notification Box (Non-intrusive, dashboard remains fully visible) */
    <aside 
      aria-label="Critical Defect Notification"
      className="fixed bottom-14 right-8 z-[200] w-[460px] max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-2xl border-2 border-red-500 overflow-hidden flex flex-col drop-shadow-2xl animate-in slide-in-from-bottom-4 duration-150 select-none"
    >
      {/* Compact Alert Header Bar */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white px-4 py-2 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-red-900/60 rounded-full">
            <AlertTriangle size={16} className="text-yellow-300 animate-pulse" />
          </div>
          <span className="text-xs font-black tracking-wider uppercase">
            {alarm.alert_label || 'Defect Detected • Line Interlock'}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 bg-red-900/80 px-2 py-0.5 rounded text-[11px] font-bold border border-red-400/40">
          <Bell size={11} className="animate-bounce" />
          <span>#{alarm.defect_id || 1}</span>
        </div>
      </div>

      {/* Compact 1-2 Line Details */}
      <div className="p-3.5 bg-slate-50 flex flex-col gap-2">
        <div className="bg-white p-2.5 rounded-lg border border-red-200 shadow-2xs text-xs flex flex-col gap-1.5">
          {/* Line 1: Code comparison OR Alert Source */}
          {alarm.scanned_code && alarm.expected_code ? (
            <div className="flex items-center justify-between text-[12px] font-bold">
              <span className="text-gray-500">Scanned: <strong className="text-red-600 font-mono">{alarm.scanned_code || 'UNREAD'}</strong></span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">Expected: <strong className="text-emerald-700 font-mono">{alarm.expected_code || 'N/A'}</strong></span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[12px] font-bold">
              <span className="text-gray-600">Subsystem: <strong className="text-[#123681] uppercase font-mono">{alarm.alert_key || 'HARDWARE'}</strong></span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-300">
                {alarm.priority || 'CRITICAL'}
              </span>
            </div>
          )}

          {/* Line 2: Interlock reason & description & time */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            <span className="text-red-600 font-semibold truncate" title={alarm.description || alarm.reason}>
              {alarm.description || alarm.reason || 'Hardware Interlock Stop'}
            </span>
            <span className="font-mono text-gray-400 text-[10px] shrink-0 ml-2">{alarm.timestamp}</span>
          </div>
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className="bg-white px-3.5 py-2.5 border-t border-gray-200 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          {/* Silence Buzzer */}
          <button
            onClick={handleSilence}
            disabled={isSilenced || isProcessing}
            type="button"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all shadow-xs cursor-pointer ${
              isSilenced
                ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
            title="Silence the active PLC alarm buzzer"
          >
            <VolumeX size={13} />
            <span>{isSilenced ? 'Silenced' : 'Silence'}</span>
          </button>

          {/* Alert Configuration Link */}
          {onOpenAlertConfig && (
            <button
              onClick={onOpenAlertConfig}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors cursor-pointer"
              title="Open Alert Configuration settings"
            >
              <Settings size={13} className="text-[#153472]" />
              <span>Config</span>
            </button>
          )}
        </div>

        {/* Accept & Resume */}
        <button
          onClick={handleAccept}
          disabled={isProcessing}
          type="button"
          className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-black tracking-wider uppercase text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Play size={13} fill="white" />
          <span>{isProcessing ? 'Resuming...' : 'Accept & Resume'}</span>
        </button>
      </div>
    </aside>
  );
};

export default CriticalAlarmModal;

