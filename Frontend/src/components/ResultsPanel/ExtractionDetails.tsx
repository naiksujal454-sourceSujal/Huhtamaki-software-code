import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Scan, Tag } from 'lucide-react';
import type { InspectionEvent } from '../../services/inspectionService';
import { formatDateTime, subscribeToDateFormat } from '../../services/dateFormatService';

interface ExtractionDetailsProps {
  lastEvent: InspectionEvent | null;
  isRunning: boolean;
  activeRecipeName?: string;
  expectedCode?: string;
}

const ExtractionDetails: React.FC<ExtractionDetailsProps> = ({
  lastEvent,
  isRunning,
  activeRecipeName,
  expectedCode,
}) => {
  const [, setFmtTick] = useState(0);
  useEffect(() => {
    return subscribeToDateFormat(() => setFmtTick(t => t + 1));
  }, []);

  const isMatch = lastEvent?.status === 'OK';
  const hasEvent = lastEvent !== null;

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden">
      
      {/* Primary Verification Status Banner */}
      <div className="p-2 border-b border-gray-200 bg-gray-50 shrink-0">
        {!hasEvent ? (
          <div className="bg-gray-200 text-gray-600 px-3 py-1.5 rounded text-xs font-bold flex items-center justify-between">
            <span>VERIFICATION STATUS:</span>
            <span className="bg-gray-300 px-2 py-0.5 rounded text-[11px]">STANDBY / IDLE</span>
          </div>
        ) : isMatch ? (
          <div className="bg-emerald-600 text-white px-3 py-1.5 rounded shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm tracking-wide">
              <CheckCircle2 size={16} className="text-white" />
              <span>STATUS: OK (CODE MATCHED)</span>
            </div>
            <span className="bg-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
              Confidence: {lastEvent.confidence}%
            </span>
          </div>
        ) : (
          <div className="bg-red-600 text-white px-3 py-1.5 rounded shadow-sm flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 font-black text-sm tracking-wide">
              <AlertCircle size={16} className="text-yellow-300" />
              <span>STATUS: NOT OK ({lastEvent.reason})</span>
            </div>
            <span className="bg-red-800 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
              INTERLOCK STOP
            </span>
          </div>
        )}
      </div>

      {/* Main Inspection Metrics Grid */}
      <div className="flex-1 overflow-hidden p-2.5 flex flex-col justify-start gap-2">
        {!hasEvent ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center text-xs">
            <Scan size={32} className="text-gray-300 mb-1.5 stroke-[1.5]" />
            <p className="font-semibold text-gray-500">Ready for Live Inspection</p>
            <p className="text-[11px] mt-0.5 text-gray-400">
              Select recipe and click Start. Scanned barcodes will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-xs">
            
            {/* Scanned vs Expected Box */}
            <div className="border border-gray-200 rounded overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between bg-slate-100 px-3.5 py-2 border-b border-gray-200 font-bold text-gray-700">
                <span className="flex items-center gap-1.5 text-xs">
                  <Tag size={13} className="text-blue-600" />
                  Scanned 1D Barcode:
                </span>
                <span className={`font-mono text-sm font-black ${isMatch ? 'text-emerald-700' : 'text-red-600'}`}>
                  {lastEvent.scanned_code || 'UNREADABLE'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-white px-3.5 py-1.5 font-bold text-gray-700">
                <span className="text-gray-500 text-xs">Expected Reference Code:</span>
                <span className="font-mono text-xs text-gray-800 font-bold">
                  {lastEvent.expected_code || expectedCode || 'N/A'}
                </span>
              </div>
            </div>

            {/* Detailed Key-Value Rows */}
            <div className="border border-gray-200 rounded divide-y divide-gray-100 bg-white shadow-2xs">
              <div className="flex justify-between py-1.5 px-3.5 text-xs">
                <span className="font-semibold text-gray-500">Active Recipe:</span>
                <span className="font-bold text-gray-800">{lastEvent.recipe_name || activeRecipeName || 'recipe1'}</span>
              </div>

              <div className="flex justify-between py-1.5 px-3.5 text-xs">
                <span className="font-semibold text-gray-500">Inspection Time:</span>
                <span className="font-mono text-gray-700 font-medium">{formatDateTime(lastEvent.inspected_at, true)}</span>
              </div>

              <div className="flex justify-between py-1.5 px-3.5 text-xs">
                <span className="font-semibold text-gray-500">Processing Latency:</span>
                <span className="font-mono text-emerald-700 font-bold">{lastEvent.latency_ms} ms</span>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default ExtractionDetails;
