import React from 'react';

interface StatusWidgetProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  statusType?: 'OK' | 'NOT OK' | 'PAUSED' | 'IDLE';
}

const StatusWidget: React.FC<StatusWidgetProps> = ({ label, value, highlight, statusType }) => {
  const strVal = String(value).toUpperCase();

  let styleClasses = 'text-gray-800 border-gray-200 bg-white';

  if (statusType === 'OK' || strVal === 'OK') {
    styleClasses = 'text-emerald-600 border-emerald-400 bg-emerald-50/90 font-black';
  } else if (statusType === 'NOT OK' || strVal === 'NOT OK' || highlight) {
    styleClasses = 'text-[#c91427] border-red-400 bg-red-50/90 font-black animate-pulse';
  } else if (statusType === 'PAUSED' || strVal === 'PAUSED') {
    styleClasses = 'text-amber-600 border-amber-300 bg-amber-50/80 font-black';
  } else if (statusType === 'IDLE' || strVal === 'IDLE') {
    styleClasses = 'text-gray-500 border-gray-200 bg-gray-50 font-bold';
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-w-[75px]">
      <div className="font-bold text-[11px] mb-1 uppercase text-[#476282] tracking-wider">{label}</div>
      <div className={`w-full py-1 text-center text-lg rounded-[4px] border shadow-xs transition-colors duration-150 ${styleClasses}`}>
        {value}
      </div>
    </div>
  );
};

export default StatusWidget;

