import React from 'react';
import ExtractionDetails from './ExtractionDetails.tsx';
import EventLogs from './EventLogs.tsx';
import type { InspectionEvent } from '../../services/inspectionService';

interface ResultsPanelProps {
  isRunning: boolean;
  lastEvent?: InspectionEvent | null;
  activeRecipeName?: string;
  expectedCode?: string;
  recentEvents?: InspectionEvent[];
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({
  isRunning,
  lastEvent = null,
  activeRecipeName,
  expectedCode,
  recentEvents = [],
}) => {
  return (
    <div className="flex-1 flex flex-col gap-2 w-full h-full relative min-h-0 overflow-hidden">
      
      {/* Top Results Panel - Exact 50% Height & 100% Width */}
      <div className="flex-1 basis-1/2 flex flex-col bg-white p-1.5 shadow-sm rounded-sm min-h-0 overflow-hidden w-full">
        <div className="bg-[#183b80] text-white font-bold text-sm px-3 py-1.5 flex items-center shrink-0">
          Inspection Result
        </div>
        <div className="flex-1 bg-white border-x border-b border-gray-200 overflow-hidden flex flex-col min-h-0">
          <ExtractionDetails
            isRunning={isRunning}
            lastEvent={lastEvent}
            activeRecipeName={activeRecipeName}
            expectedCode={expectedCode}
          />
        </div>
      </div>

      {/* Bottom Logs Panel - Exact 50% Height & 100% Width */}
      <div className="flex-1 basis-1/2 flex flex-col bg-white p-1.5 shadow-sm rounded-sm min-h-0 overflow-hidden w-full">
        <div className="bg-[#183b80] text-white font-bold text-sm px-3 py-1.5 flex items-center shrink-0">
          Event Logs
        </div>
        <div className="flex-1 bg-white border-x border-b border-gray-200 overflow-hidden flex flex-col min-h-0">
          <EventLogs 
            isRunning={isRunning} 
            recentEvents={recentEvents}
            lastEvent={lastEvent}
          />
        </div>
      </div>
      
    </div>
  );
};

export default ResultsPanel;
