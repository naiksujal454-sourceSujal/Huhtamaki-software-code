import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, FolderOpen, Scan, Zap, AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { getApiUrl } from '../../services/apiConfig';

interface ScannerViewerProps {
  isRunning: boolean;
  onOpenPreset: () => void;
  activeImageUrl?: string | null;
  rawImageUrl?: string | null;
  processedImageUrl?: string | null;
  activeRecipeName?: string;
  lastStatus?: 'OK' | 'NOK' | 'IDLE';
  scannedCode?: string;
  expectedCode?: string;
  scanSequence?: number;
  latencyMs?: number | string;
  simulateDefects?: boolean;
  onToggleDefects?: (enabled: boolean) => void;
  stopOnDefect?: boolean;
  onToggleStopOnDefect?: (stop: boolean) => void;
  onInjectDefect?: () => void;
  onOpenScannerConfig?: () => void;
}

const ScannerViewer: React.FC<ScannerViewerProps> = ({
  isRunning,
  onOpenPreset,
  activeImageUrl,
  rawImageUrl,
  processedImageUrl,
  activeRecipeName = 'recipe1',
  lastStatus = 'IDLE',
  scannedCode = '',
  expectedCode = '',
  scanSequence = 0,
  latencyMs = '0',
  simulateDefects = true,
  onToggleDefects,
  stopOnDefect = true,
  onToggleStopOnDefect,
  onInjectDefect,
  onOpenScannerConfig,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showProcessed, setShowProcessed] = useState(true);
  const [frameFlash, setFrameFlash] = useState(false);

  // Trigger brief visual strobe on each new frame arrival
  useEffect(() => {
    if (scanSequence > 0 && isRunning) {
      setFrameFlash(true);
      const timer = setTimeout(() => setFrameFlash(false), 140);
      return () => clearTimeout(timer);
    }
  }, [scanSequence, isRunning]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.75));

  const isOk = lastStatus === 'OK';
  const isNok = lastStatus === 'NOK';

  // Determine current image depending on Raw vs Processed toggle
  const rawTarget = showProcessed
    ? (processedImageUrl || activeImageUrl)
    : (rawImageUrl || activeImageUrl);
  const displayImage = rawTarget ? getApiUrl(rawTarget) : null;

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-white relative p-1.5 rounded-md drop-shadow-sm select-none overflow-hidden">

      {/* Top Toolbar */}
      <div className="flex flex-wrap justify-between items-center px-2 py-1 bg-white mb-1 shrink-0 gap-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPreset}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-pixtron-blue rounded transition-colors cursor-pointer border border-gray-200"
            title="Select / Load Recipe from Backend"
          >
            <FolderOpen size={16} className="text-pixtron-blue" />
            <span>Preset: <strong className="text-[#123681]">{activeRecipeName}</strong></span>
          </button>

          {/* Quick Matrix 220 Optical Setup Button */}
          {onOpenScannerConfig && (
            <button
              onClick={onOpenScannerConfig}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-[#123681] bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer border border-blue-200 shadow-2xs"
              title="Open Datalogic Matrix 220 Hardware & Optical Configuration"
            >
              <Scan size={14} className="text-[#123681]" />
              <span>Matrix 220 Setup</span>
            </button>
          )}

          {/* Quick Defect Injection Button */}
          {onInjectDefect && (
            <button
              onClick={onInjectDefect}
              disabled={!isRunning}
              title="Force next container to trigger defect/mismatch"
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold rounded shadow-sm transition-all cursor-pointer ${isRunning
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                }`}
            >
              <Zap size={13} fill="currentColor" />
              <span>⚡ Inject Defect</span>
            </button>
          )}

          {/* Defect Simulation Toggle */}
          {onToggleDefects && (
            <button
              onClick={() => onToggleDefects(!simulateDefects)}
              className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${simulateDefects
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                }`}
              title="Toggle automatic periodic defect injection (SKU mismatch, missing code)"
            >
              Defects: <strong className={simulateDefects ? 'text-amber-700' : 'text-gray-500'}>{simulateDefects ? 'ON' : 'OFF'}</strong>
            </button>
          )}

          {/* Stop on Defect Toggle */}
          {onToggleStopOnDefect && (
            <button
              onClick={() => onToggleStopOnDefect(!stopOnDefect)}
              className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${stopOnDefect
                  ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                  : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                }`}
              title={stopOnDefect ? 'Line halts on defect for operator acknowledgment' : 'Auto-reject: Conveyor continues without halting'}
            >
              Auto-Stop: <strong className={stopOnDefect ? 'text-red-700' : 'text-blue-700'}>{stopOnDefect ? 'ON' : 'OFF'}</strong>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Active Mode Tag */}
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${showProcessed
              ? 'bg-blue-50 text-pixtron-blue border-blue-200'
              : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}>
            {showProcessed ? 'Barcode ROI' : 'Full Raw Image'}
          </span>

          <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
            <ZoomOut size={16} onClick={handleZoomOut} className="text-gray-600 cursor-pointer hover:text-pixtron-blue" />
            <span className="text-[10px] font-mono font-bold text-gray-600">{Math.round(zoomLevel * 100)}%</span>
            <ZoomIn size={16} onClick={handleZoomIn} className="text-gray-600 cursor-pointer hover:text-pixtron-blue" />
          </div>
        </div>
      </div>

      {/* Main Vision Screen */}
      <div className={`flex-1 bg-[#0f1115] relative overflow-hidden rounded-md border-2 transition-all duration-100 flex items-center justify-center ${frameFlash
          ? isOk
            ? 'border-emerald-400 ring-2 ring-emerald-500/40'
            : 'border-red-500 ring-4 ring-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.7)]'
          : isNok
            ? 'border-red-500 ring-2 ring-red-500/50'
            : 'border-gray-800'
        }`}>

        {/* Live HUD Overlay: Sequence & Latency */}
        {isRunning && (
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-sm border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isNok ? 'bg-red-500' : 'bg-emerald-400'} animate-ping`}></span>
              <span>FRAME #{String(scanSequence).padStart(5, '0')}</span>
              <span className="text-gray-500">|</span>
              <span className="text-amber-300">{latencyMs}ms</span>
            </div>
          </div>
        )}

        {/* Prominent Defect Warning Banner */}
        {isNok && isRunning && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-rose-600 text-white font-extrabold text-[11px] px-3.5 py-1 rounded-full border border-rose-300 shadow-[0_0_20px_rgba(225,29,72,0.8)] z-20 flex items-center gap-1.5 animate-bounce pointer-events-none">
            <AlertTriangle size={14} />
            <span>DEFECT: BARCODE MISMATCH (EJECT SOLENOID FIRED)</span>
          </div>
        )}

        {/* Active Inspection Image Feed */}
        {displayImage ? (
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-150 p-2"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              src={displayImage}
              alt={showProcessed ? "Cropped Barcode ROI" : "Raw Inspection Feed"}
              loading="eager"
              decoding="sync"
              className="max-h-full max-w-full object-contain filter contrast-105 rounded shadow-lg"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 gap-2 opacity-60">
            <Scan size={48} className="stroke-[1.5]" />
            <span className="text-xs font-bold uppercase tracking-widest">
              Camera / Scanner Stream Standby
            </span>
            <span className="text-[11px] text-gray-400">
              Data Matrix 220 Optical Inspection Frame
            </span>
          </div>
        )}

        {/* Industrial Target Reticle / Barcode Scanner Overlay */}
        {isRunning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {showProcessed ? (
              /* Cropped Barcode Scan Laser and Verified Badge */
              <div className="relative w-4/5 h-3/5 border border-cyan-500/40 rounded flex flex-col justify-between p-2">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent absolute top-1/2 -translate-y-1/2 opacity-90 animate-pulse"></div>
                <div className="bg-slate-900/90 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-cyan-600/50 self-start flex items-center gap-1.5">
                  <Scan size={10} />
                  <span>DECODED ROI • ROTATED 0°/90° HORIZONTAL</span>
                </div>
                {scannedCode && (
                  <div className="bg-slate-900/90 text-white text-[11px] font-mono px-2 py-0.5 rounded font-extrabold border border-gray-600 self-start flex items-center gap-1.5">
                    <span>CODE:</span>
                    <span className={isOk ? 'text-emerald-400' : 'text-red-400'}>{scannedCode}</span>
                    {isOk ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                  </div>
                )}
              </div>
            ) : (
              /* Center Barcode Region of Interest (ROI) Frame for Raw View */
              <div className={`w-3/5 h-2/5 border-2 rounded relative transition-colors ${isOk
                  ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : isNok
                    ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse'
                    : 'border-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}>
                {/* Corner brackets */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-300"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-300"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-300"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-300"></div>

                {/* Laser Sweep Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent absolute top-1/2 -translate-y-1/2 opacity-85"></div>

                {/* ROI Label Tag */}
                <div className="absolute -top-6 left-0 bg-slate-900/90 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-cyan-600/50 flex items-center gap-1.5">
                  <Scan size={10} />
                  <span>1D BARCODE RAW ROI • MATRIX 220</span>
                </div>

                {scannedCode && (
                  <div className="absolute -bottom-6 left-0 bg-slate-900/90 text-white text-[11px] font-mono px-2 py-0.5 rounded font-extrabold border border-gray-600 flex items-center gap-1.5">
                    <span>CODE:</span>
                    <span className={isOk ? 'text-emerald-400' : 'text-red-400'}>{scannedCode}</span>
                    {isOk ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* View Toggles & Live Indicator Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-3 z-10">
          <div className="flex bg-black/70 backdrop-blur-sm rounded overflow-hidden text-[11px] font-bold border border-gray-700 shadow-md">
            <button
              onClick={() => setShowProcessed(false)}
              className={`px-3 py-1 transition-colors cursor-pointer ${!showProcessed ? 'bg-pixtron-blue text-white font-extrabold' : 'text-gray-300 hover:bg-gray-800'
                }`}
            >
              Raw
            </button>
            <button
              onClick={() => setShowProcessed(true)}
              className={`px-3 py-1 transition-colors cursor-pointer ${showProcessed ? 'bg-emerald-600 text-white font-extrabold' : 'text-gray-300 hover:bg-gray-800'
                }`}
            >
              ROI Processed
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-black/70 px-2.5 py-1 rounded border border-gray-700 shadow">
            <div
              className={`w-2 h-2 rounded-full ${isRunning
                  ? isNok
                    ? 'bg-red-500 animate-ping'
                    : 'bg-emerald-500 animate-pulse'
                  : 'bg-gray-500'
                }`}
            ></div>
            <span
              className={`text-[10px] font-extrabold tracking-wider ${isRunning ? (isNok ? 'text-red-400' : 'text-emerald-400') : 'text-gray-400'
                }`}
            >
              {isRunning ? 'LIVE FEED' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Footer Program Badge */}
        <div className="absolute bottom-2 left-3 text-[10px] font-mono text-gray-400 bg-black/60 px-2 py-0.5 rounded border border-gray-800">
          Program: <strong className="text-gray-200">{activeRecipeName}</strong>
        </div>

      </div>
    </div>
  );
};

export default ScannerViewer;
