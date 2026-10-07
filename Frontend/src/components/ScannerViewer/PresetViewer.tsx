import React from 'react';
import { FolderOpen, Scan, Zap, AlertTriangle, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import { getApiUrl } from '../../services/apiConfig';

interface PresetViewerProps {
  isRunning: boolean;
  onOpenPreset: () => void;
  activeImageUrl?: string | null;
  activeRecipeName?: string;
  expectedCode?: string;
  simulateDefects?: boolean;
  onToggleDefects?: (enabled: boolean) => void;
  stopOnDefect?: boolean;
  onToggleStopOnDefect?: (stop: boolean) => void;
  onInjectDefect?: () => void;
  onOpenScannerConfig?: () => void;
}

const PresetViewer: React.FC<PresetViewerProps> = ({
  isRunning,
  onOpenPreset,
  activeImageUrl,
  activeRecipeName = 'recipe1',
  expectedCode = '',
  simulateDefects = true,
  onToggleDefects,
  stopOnDefect = true,
  onToggleStopOnDefect,
  onInjectDefect,
  onOpenScannerConfig,
}) => {
  const displayImage = activeImageUrl ? getApiUrl(activeImageUrl) : null;

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-white relative p-1.5 rounded-md shadow-sm border border-gray-200 select-none overflow-hidden gap-1.5">
      
      {/* Top Box: Preset Name & Target Data + Controls */}
      <div className="bg-slate-50 border border-gray-200 rounded p-2.5 flex flex-wrap justify-between items-center gap-2 shrink-0">
        
        {/* Left: Preset & Target Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#123681]/10 text-[#123681] flex items-center justify-center shrink-0 border border-[#123681]/20">
            <FolderOpen size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Preset / Recipe:</span>
              <span className="font-extrabold text-sm text-[#123681]">{activeRecipeName}</span>
              <button
                onClick={onOpenPreset}
                className="ml-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs transition-colors cursor-pointer"
                title="Select a different preset recipe"
              >
                Change Preset
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Target Data:</span>
              <span className="font-mono text-xs font-bold text-gray-800 bg-white px-2 py-0.2 rounded border border-gray-200">
                {expectedCode || 'No target configured'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Hardware & Defect Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenScannerConfig && (
            <button
              onClick={onOpenScannerConfig}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-[#123681] bg-white hover:bg-blue-50 rounded transition-colors cursor-pointer border border-blue-200 shadow-2xs"
              title="Open Datalogic Matrix 220 Hardware & Optical Configuration"
            >
              <Scan size={14} className="text-[#123681]" />
              <span>Matrix 220 Setup</span>
            </button>
          )}

          {onInjectDefect && (
            <button
              onClick={onInjectDefect}
              disabled={!isRunning}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded transition-colors shadow-2xs ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-95'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
              title="Inject a real Barcode Mismatch Defect into stream"
            >
              <Zap size={13} />
              <span>Inject Defect</span>
            </button>
          )}

          {onToggleDefects && (
            <button
              onClick={() => onToggleDefects(!simulateDefects)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded border transition-colors cursor-pointer ${
                simulateDefects
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
              title="Toggle automatic defect simulation during continuous runs"
            >
              <AlertTriangle size={12} className={simulateDefects ? 'text-amber-600' : 'text-gray-400'} />
              <span>Defects: {simulateDefects ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {onToggleStopOnDefect && (
            <button
              onClick={() => onToggleStopOnDefect(!stopOnDefect)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded border transition-colors cursor-pointer ${
                stopOnDefect
                  ? 'bg-red-50 text-red-800 border-red-300'
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
              title="Toggle automatic line stop and interlock on defect"
            >
              <ShieldAlert size={12} className={stopOnDefect ? 'text-red-600' : 'text-gray-400'} />
              <span>Auto-Stop: {stopOnDefect ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Box: Preset Reference Image */}
      <div className="flex-1 flex flex-col bg-slate-900/5 border border-gray-200 rounded overflow-hidden min-h-0 relative">
        <div className="bg-slate-100 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-[#123681]" />
            <span className="text-xs font-bold text-gray-700">Preset Master Reference Image</span>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
            {activeRecipeName}.png
          </span>
        </div>

        {/* Image Display Area */}
        <div className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-slate-950/90 relative">
          {displayImage ? (
            <img
              src={displayImage}
              alt={`Preset ${activeRecipeName}`}
              className="max-h-full max-w-full object-contain rounded shadow-lg transition-transform duration-200 hover:scale-[1.02]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
              <ImageIcon size={40} className="text-gray-600 stroke-[1.5]" />
              <p className="text-xs font-medium text-gray-400">No preset image loaded for {activeRecipeName}</p>
            </div>
          )}

          {/* Bottom Overlay Label */}
          <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded font-mono flex items-center gap-2 border border-white/10 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>Program: <strong>{activeRecipeName}</strong></span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-300">Target: {expectedCode}</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PresetViewer;
