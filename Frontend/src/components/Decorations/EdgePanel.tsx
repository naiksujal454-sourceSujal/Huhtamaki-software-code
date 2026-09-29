import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface EdgePanelProps {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled?: boolean;
}

const EdgePanel: React.FC<EdgePanelProps> = ({ direction, onClick, disabled = false }) => {
  const isLeft = direction === 'left';
  return (
    <div 
      className={`absolute top-1/2 -translate-y-1/2 ${isLeft ? 'left-0' : 'right-0'} z-50`}
    >
      <button 
        type="button"
        disabled={disabled}
        aria-label={isLeft ? 'Settings & Dashboard Navigation' : 'Hardware & Connections Navigation'}
        className={`w-[40px] h-[80px] border-none outline-none flex items-center justify-center transition-all ${
          disabled
            ? 'bg-white/40 text-gray-300 cursor-not-allowed opacity-30 shadow-none pointer-events-none'
            : 'bg-white text-pixtron-blue cursor-pointer hover:bg-gray-100 hover:scale-105 active:scale-95 drop-shadow-md'
        }`}
        style={{
          clipPath: isLeft 
            ? 'polygon(0 0, 100% 50%, 0 100%)' 
            : 'polygon(100% 0, 0 50%, 100% 100%)'
        }}
        onClick={disabled ? undefined : onClick}
      >
        <div className={disabled ? 'text-gray-300' : 'text-pixtron-blue'}>
          {isLeft ? <ChevronRight size={24} className="ml-1" /> : <ChevronLeft size={24} className="mr-1" />}
        </div>
      </button>
    </div>
  );
};

export default EdgePanel;
