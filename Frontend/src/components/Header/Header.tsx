import React from 'react';
import { AlertTriangle } from 'lucide-react';
import CounterWidget from './CounterWidget.tsx';
import ControlsWidget, { type InspectionState } from './ControlsWidget.tsx';
import StatusWidget from './StatusWidget.tsx';

interface HeaderProps {
  state: InspectionState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  passCount: number;
  failCount: number;
  totalCount: number;
  passRate: number;
  inspectionTimeMs: number | string;
  speedPpm: number;
  lastStatus: 'OK' | 'NOT OK' | 'IDLE' | 'PAUSED';
  alertCount?: number;
  hasActiveAlarm?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  state,
  onStart,
  onPause,
  onResume,
  onStop,
  passCount,
  failCount,
  totalCount,
  passRate,
  inspectionTimeMs,
  speedPpm,
  lastStatus,
  alertCount = 0,
  hasActiveAlarm = false,
}) => {
  return (
    <div className="flex justify-between items-stretch h-[110px] w-full gap-4">

      {/* Left Counters - Live from Backend */}
      <div className="flex-[3.5] bg-white flex items-center px-4 gap-4 drop-shadow-sm rounded-br-[32px] rounded-tl-md rounded-bl-md">
        <CounterWidget label="PASS" value={String(passCount)} isPass />
        <CounterWidget label="FAIL" value={String(failCount)} isFail />
        <CounterWidget label="TOTAL" value={String(totalCount)} />
        <CounterWidget label="%RR" value={passRate.toFixed(1)} />
      </div>

      {/* Center Controls (Start / Pause / Resume / Stop) */}
      <div className="flex-[3] flex justify-center items-stretch py-1">
        <ControlsWidget
          state={state}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
        />
      </div>

      {/* Right Status - Live Metrics & OK / NOT OK Status Widget */}
      <div className="flex-[3.5] bg-white flex items-center justify-around px-4 gap-3 drop-shadow-sm rounded-bl-[32px] rounded-tr-md rounded-br-md">
        <StatusWidget
          label="INSPECTION TIME (ms)"
          value={state === 'RUNNING' || state === 'PAUSED' ? String(inspectionTimeMs) : "0"}
        />
        <StatusWidget
          label="SPEED (PPM)"
          value={state === 'RUNNING' ? String(speedPpm) : (state === 'PAUSED' ? String(speedPpm) : "0")}
        />
        <StatusWidget
          label="STATUS"
          value={hasActiveAlarm ? 'NOT OK' : lastStatus}
          statusType={hasActiveAlarm ? 'NOT OK' : lastStatus}
        />
      </div>

    </div>
  );
};

export default Header;
