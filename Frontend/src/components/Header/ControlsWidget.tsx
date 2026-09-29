import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import pixtronLogo from '../../assets/pixtron_systems_logo.png';

export type InspectionState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

interface ControlsWidgetProps {
  state: InspectionState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const ControlsWidget: React.FC<ControlsWidgetProps> = ({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
}) => {
  const isRunning = state === 'RUNNING';
  const isPaused = state === 'PAUSED';
  const isIdle = state === 'IDLE' || state === 'STOPPED';

  const handleLeftClick = () => {
    if (isIdle) {
      onStart();
    } else if (isRunning) {
      onPause();
    } else if (isPaused) {
      onResume();
    }
  };

  return (
    <div className="w-full h-full bg-white relative p-[4px] shadow-sm rounded-md">
      <div className="w-full h-full bg-pixtron-blue flex justify-between rounded-sm overflow-hidden">

        {/* Left Action Button (Start / Pause / Resume) */}
        <div className="flex-1 bg-white/90 flex items-center justify-center border-r-4 border-pixtron-blue">
          <button
            onClick={handleLeftClick}
            title={isIdle ? 'Start Inspection' : isRunning ? 'Pause Inspection' : 'Resume Inspection'}
            className={`flex items-center justify-center w-12 h-12 rounded-full shadow-md transition-all active:scale-95 cursor-pointer ${
              isRunning
                ? 'bg-amber-500 border-[3px] border-amber-300 hover:bg-amber-600'
                : isPaused
                ? 'bg-emerald-600 border-[3px] border-emerald-300 hover:bg-emerald-700 animate-pulse'
                : 'bg-pixtron-green border-[4px] border-[#a3d9a5] hover:bg-emerald-600'
            }`}
          >
            {isRunning ? (
              <Pause fill="white" size={20} color="white" />
            ) : isPaused ? (
              <Play fill="white" size={20} className="ml-0.5" color="white" />
            ) : (
              <Play fill="white" size={20} className="ml-0.5" color="white" />
            )}
          </button>
        </div>

        {/* Center Logo & Live Status Container */}
        <div className="flex-[1.5] bg-white flex flex-col items-center justify-center px-4">
          <img src={pixtronLogo} alt="Pixtron Systems" className="h-7 object-contain mb-1" />
          <div className="text-[9px] text-gray-500 font-bold tracking-wide border-t border-gray-200 w-full text-center pt-1 mt-1">
            System Status
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700">
            <div
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? 'bg-pixtron-green animate-pulse'
                  : isPaused
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-gray-400'
              }`}
            ></div>
            <span className={isRunning ? 'text-emerald-700' : isPaused ? 'text-amber-600 font-extrabold' : 'text-gray-600'}>
              {isRunning ? 'RUNNING' : isPaused ? 'PAUSED' : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Right Stop Button */}
        <div className="flex-1 bg-white/90 flex items-center justify-center border-l-4 border-pixtron-blue">
          <button
            onClick={onStop}
            disabled={isIdle}
            title="Stop Inspection & Finalize Batch"
            className={`flex items-center justify-center w-12 h-12 rounded-full shadow-md transition-all active:scale-95 ${
              isIdle
                ? 'bg-[#5b687f] border-[4px] border-[#a5b2c7] opacity-60 cursor-not-allowed'
                : 'bg-pixtron-red border-[3px] border-[#eeb7bd] hover:bg-red-700 cursor-pointer'
            }`}
          >
            <Square fill="white" size={16} color="white" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default ControlsWidget;
