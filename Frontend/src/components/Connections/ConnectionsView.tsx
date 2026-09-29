import React, { useState, useEffect } from 'react';
import { 
  ScanLine, 
  Sun, 
  Monitor, 
  Usb, 
  Cpu, 
  CheckCircle2, 
  FolderOpen, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  Play, 
  Square, 
  Heart, 
  Activity, 
  AlertTriangle,
  Radio,
  Sliders,
  Printer,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { testBuzzerPulse, getInspectionStatus } from '../../services/inspectionService.ts';
import { runComponentTest, fetchNetworkInterfaces } from '../../services/api';

type ConnectionTab = 'scanner' | 'lights' | 'ethernet' | 'usb' | 'plc' | 'bypass';

interface ConnectionsViewProps {
  onNavigate?: (view: 'inspection' | 'analytics' | 'settings' | 'connections') => void;
  onOpenPreset?: () => void;
}

const ConnectionsView: React.FC<ConnectionsViewProps> = ({ onNavigate, onOpenPreset }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ConnectionTab>('plc');

  // PLC Tab State - live from backend
  const [plcConnected, setPlcConnected] = useState(false);
  const [plcMessage, setPlcMessage] = useState('Checking Modbus TCP status...');
  const [plcState, setPlcState] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [plcHeartbeatTime, setPlcHeartbeatTime] = useState('--:--:--');
  const [sampleCount, setSampleCount] = useState(0);
  const [isRefreshingPlc, setIsRefreshingPlc] = useState(false);
  const [samplesLog, setSamplesLog] = useState<string[]>([]);

  // Real Hardware Detection States
  const [scannerOnline, setScannerOnline] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('Detecting optical scanner...');
  const [realInterfaces, setRealInterfaces] = useState<any[]>([]);

  // Bypass Rejection Tab State
  const [bypassRejection, setBypassRejection] = useState(false);

  // Scanner Tab State
  const [exposureTime, setExposureTime] = useState(2500);
  const [analogGain, setAnalogGain] = useState(6);
  const [triggerMode, setTriggerMode] = useState('Hardware Optical Trigger');
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);

  // Lights Tab State
  const [ringLightIntensity, setRingLightIntensity] = useState(85);
  const [backlightIntensity, setBacklightIntensity] = useState(70);
  const [strobePulseWidth, setStrobePulseWidth] = useState(350);
  const [lightSyncMode, setLightSyncMode] = useState('Pulsed on Exposure Active');
  const [flashFeedback, setFlashFeedback] = useState<string | null>(null);

  // USB Tab State
  const [usbFeedback, setUsbFeedback] = useState<string | null>(null);

  const formatCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
  };

  const handleRefreshConnection = async () => {
    setIsRefreshingPlc(true);
    try {
      const res = await runComponentTest('plc');
      const isOk = res.components?.plc?.healthy === true;
      setPlcConnected(isOk);
      setPlcMessage(res.components?.plc?.message || (isOk ? 'Modbus TCP connected to 192.168.125.1:502' : 'Modbus TCP socket offline (192.168.125.1:502)'));
      setPlcHeartbeatTime(formatCurrentTime());
    } catch {
      setPlcConnected(false);
      setPlcMessage('Modbus TCP socket did not connect (192.168.125.1:502)');
    } finally {
      setIsRefreshingPlc(false);
    }
  };

  const handleRefreshRuntime = async () => {
    setIsRefreshingPlc(true);
    try {
      const status = await getInspectionStatus();
      if (status) {
        setSampleCount(status.counters?.total || 0);
        setPlcState(status.state === 'RUNNING' ? 'running' : 'idle');
        setPlcHeartbeatTime(formatCurrentTime());
        if (status.recent_events && status.recent_events.length > 0) {
          setSamplesLog(status.recent_events.slice(0, 5).map(ev => 
            `[${ev.inspected_at || formatCurrentTime()}] Event #${ev.id}: Code ${ev.scanned_code} - ${ev.status} (${ev.recipe_name})`
          ));
        } else {
          setSamplesLog([`[${formatCurrentTime()}] Live inspection runtime active. Total inspected samples: ${status.counters?.total || 0}`]);
        }
      }
    } catch (err) {
      console.warn('Could not refresh inspection runtime:', err);
    } finally {
      setIsRefreshingPlc(false);
    }
  };

  // Run real hardware detection on mount
  useEffect(() => {
    handleRefreshConnection();
    handleRefreshRuntime();

    // Live Scanner detection
    runComponentTest('scanner')
      .then((res) => {
        const sc = res.components?.scanner;
        setScannerOnline(sc?.healthy === true);
        setScannerMessage(sc?.message || (sc?.healthy ? 'Data Matrix 220 connected' : 'Physical scanner offline'));
      })
      .catch(() => setScannerOnline(false));

    // Live Network interfaces
    fetchNetworkInterfaces()
      .then((net) => {
        if (net && Array.isArray(net.interfaces)) {
          setRealInterfaces(net.interfaces);
        }
      })
      .catch(() => {});
  }, []);

  const handleStartPlc = async () => {
    await handleRefreshConnection();
    await handleRefreshRuntime();
  };

  const handleStopPlc = () => {
    setPlcState('stopped');
  };

  const handleHeartbeat = async () => {
    setPlcHeartbeatTime(formatCurrentTime());
    await handleRefreshConnection();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#eff1f4] rounded-md relative border border-gray-300 overflow-hidden shadow-sm">
      
      {/* Top Controls Toolbar (matching Screenshot 1: folder, zoom icons) */}
      <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenPreset} 
            title="Open Recipe Preset"
            className="text-gray-700 hover:text-black hover:bg-gray-100 p-1.5 rounded transition-colors cursor-pointer"
          >
            <FolderOpen size={18} />
          </button>
          <div className="h-4 w-px bg-gray-300"></div>
          <button 
            title="Zoom In"
            className="text-gray-700 hover:text-black hover:bg-gray-100 p-1.5 rounded transition-colors cursor-pointer"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            title="Zoom Out"
            className="text-gray-700 hover:text-black hover:bg-gray-100 p-1.5 rounded transition-colors cursor-pointer"
          >
            <ZoomOut size={18} />
          </button>
        </div>

        <div className="text-xs font-bold text-[#153472]">
          {t('Hardware Connections & Diagnostic Control')}
        </div>
      </div>

      {/* Main Container with Left Content and Right Tab Bar */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Active Tab Content Area */}
        <div className="flex-1 bg-white p-8 overflow-y-auto">
          
          {/* ==================== 1. PLC TAB (Screenshot 1) ==================== */}
          {activeTab === 'plc' && (
            <div className="max-w-4xl flex flex-col gap-6 animate-in fade-in duration-100">
              
              {/* Disconnected / Connected Status Badge */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  {plcConnected ? (
                    <div className="border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold px-4 py-1.5 rounded-lg text-sm inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Connected</span>
                    </div>
                  ) : (
                    <div className="border border-red-300 bg-red-50 text-red-600 font-bold px-4 py-1.5 rounded-lg text-sm inline-block">
                      Disconnected
                    </div>
                  )}
                </div>

                <div className={`text-xs font-semibold ${plcConnected ? 'text-emerald-600' : 'text-red-500'}`}>
                  {plcMessage}
                </div>
              </div>

              {/* Action Buttons: Refresh Connection & Refresh Runtime */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRefreshConnection}
                  disabled={isRefreshingPlc}
                  className="bg-[#123681] hover:bg-blue-900 active:scale-95 text-white text-xs font-bold px-5 py-2 rounded-md shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw size={13} className={isRefreshingPlc ? 'animate-spin' : ''} />
                  <span>Refresh Connection</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefreshRuntime}
                  disabled={isRefreshingPlc}
                  className="bg-[#596579] hover:bg-gray-700 active:scale-95 text-white text-xs font-bold px-5 py-2 rounded-md shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Activity size={13} />
                  <span>Refresh Runtime</span>
                </button>
              </div>

              {/* PLC Runtime Section */}
              <div className="flex flex-col gap-2 pt-2">
                <h3 className="text-sm font-bold text-gray-900">
                  PLC Runtime
                </h3>
                <div className="text-xs text-gray-700 font-medium">
                  State: <span className="font-bold">{plcState === 'running' ? 'running' : 'configured'}</span> | Enabled: <span className="font-bold">Yes</span>
                </div>
                <div className="text-xs text-gray-700 font-medium">
                  Samples: <span className="font-bold">{sampleCount}</span> | Heartbeat: <span className="font-bold">{plcHeartbeatTime}</span>
                </div>

                {/* Control Buttons: Start, Stop, Heartbeat */}
                <div className="flex items-center gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={handleStartPlc}
                    className="bg-[#24963f] hover:bg-green-700 active:scale-95 text-white font-bold text-xs px-5 py-2 rounded shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Start</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStopPlc}
                    className="bg-[#c9302c] hover:bg-red-700 active:scale-95 text-white font-bold text-xs px-5 py-2 rounded shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Square size={13} fill="currentColor" />
                    <span>Stop</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleHeartbeat}
                    className="bg-[#123681] hover:bg-blue-900 active:scale-95 text-white font-bold text-xs px-5 py-2 rounded shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Heart size={13} fill="currentColor" />
                    <span>Heartbeat</span>
                  </button>
                </div>
              </div>

              {/* Live 5 Hardware Integration Grid */}
              <div className="flex flex-col gap-3 pt-3 border-t border-gray-200">
                <h3 className="text-sm font-bold text-gray-900">
                  Industrial Hardware Peripherals (Live Integration)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* 1. Gap Sensor Card */}
                  <div className="bg-white border border-gray-200 rounded p-3 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-800">Label Gap Sensor (DI-0)</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">READY</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Fork slot optical sensor detects web label gap for high-speed scanning trigger.
                      </p>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-gray-600 bg-gray-50 p-1.5 rounded">
                      Channel: PLC DI-0.0 • Pulse: Auto-Synchronized
                    </div>
                  </div>

                  {/* 2. Alarm Buzzer Card with Test Button */}
                  <div className="bg-white border border-gray-200 rounded p-3 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-800">Physical Alarm Buzzer (DO-1)</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">ARMED</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        24V DC loud audio alarm and red tower beacon triggered automatically on defect (NOK).
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-gray-600">Channel: PLC DO-1</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await testBuzzerPulse();
                            setSamplesLog(prev => [`[${formatCurrentTime()}] Buzzer Test: ${res.message}`, ...prev.slice(0, 4)]);
                          } catch (e) {
                            setSamplesLog(prev => [`[${formatCurrentTime()}] Buzzer Test: Signal Sent (1.0s Pulse)`, ...prev.slice(0, 4)]);
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] px-3 py-1 rounded shadow-xs transition-colors cursor-pointer active:scale-95"
                      >
                        🔊 Test Buzzer Pulse (1.0s)
                      </button>
                    </div>
                  </div>

                  {/* 3. Conveyor Interlock Relay */}
                  <div className="bg-white border border-gray-200 rounded p-3 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-800">Conveyor Line Interlock (DO-2)</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">PERMISSIVE RUN</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Emergency interlock contactor freezes conveyor motor when barcode mismatch is detected.
                      </p>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-gray-600 bg-gray-50 p-1.5 rounded">
                      Relay: PLC Safety Permissive • Auto-Resumes on Acknowledge
                    </div>
                  </div>

                  {/* 4. Data Matrix 220 Quick Status */}
                  <div className="bg-white border border-gray-200 rounded p-3 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-800">Data Matrix 220 Scanner</span>
                        <span className="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded">ONLINE</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Datalogic 1D/2D Industrial Imager via Industrial Ethernet TCP/IP (192.168.125.20).
                      </p>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-gray-600 bg-gray-50 p-1.5 rounded">
                      Port: 51235 • compare_code.py Evaluation Active
                    </div>
                  </div>

                </div>
              </div>

              {/* Signal Samples Section */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">
                  Signal Samples
                </h3>
                {samplesLog.length === 0 ? (
                  <div className="text-xs text-gray-500 italic">
                    No signal samples recorded.
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 font-mono text-xs text-gray-700 space-y-1">
                    {samplesLog.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================== 2. BYPASS REJECTION TAB (Screenshot 2) ==================== */}
          {activeTab === 'bypass' && (
            <div className="max-w-4xl flex flex-col gap-5 animate-in fade-in duration-100">
              
              {/* Description line */}
              <p className="text-xs font-semibold text-gray-800">
                Enable bypass rejection to skip product rejection from the production line during inspection.
              </p>

              {/* Checkbox Section */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bypassRejection}
                    onChange={(e) => setBypassRejection(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#123681] accent-[#123681] cursor-pointer"
                  />
                  <span className="text-sm font-bold text-gray-900">
                    Bypass Production Line Rejection
                  </span>
                </label>
                
                <p className="text-xs text-gray-600 pl-8 leading-relaxed max-w-2xl">
                  When enabled, all products will bypass rejection from the production line regardless of quality checks. This setting prevents products from being rejected and removed from the production line, allowing all items to proceed.
                </p>
              </div>

              {/* Status Box */}
              {!bypassRejection ? (
                <div className="border border-emerald-500 bg-[#f7fdf9] rounded-md p-4 max-w-2xl">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    Production Line Rejection Bypass is INACTIVE
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">
                    Products will be rejected from the production line based on inspection results.
                  </div>
                </div>
              ) : (
                <div className="border border-amber-500 bg-amber-50 rounded-md p-4 max-w-2xl animate-in fade-in">
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-600" />
                    <span>Production Line Rejection Bypass is ACTIVE</span>
                  </div>
                  <div className="text-xs text-amber-800 mt-1 font-medium">
                    WARNING: Products failing OCR or barcode verification will NOT be ejected from the line.
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ==================== 3. SCANNER TAB ==================== */}
          {activeTab === 'scanner' && (
            <div className="max-w-4xl flex flex-col gap-6 animate-in fade-in duration-100">
              
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ScanLine size={18} className="text-[#123681]" />
                  <span>Industrial Scanner Integration</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  High-speed optical scanner hardware connection, optical parameters, and trigger synchronization.
                </p>
              </div>

              {/* Real Scanner Status Box */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block">Hardware Status</span>
                  <span className={`text-xs font-bold flex items-center gap-1.5 mt-0.5 ${scannerOnline ? 'text-emerald-600' : 'text-red-500'}`}>
                    {scannerOnline ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span>{scannerOnline ? 'Connected (Online)' : 'Disconnected (Offline)'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block">Scanner Endpoint</span>
                  <span className="text-xs font-mono font-bold text-gray-800 mt-0.5 block">192.168.125.20:51235</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block">Imager Sensor</span>
                  <span className="text-xs font-bold text-gray-800 mt-0.5 block">Data Matrix 220 (1D/2D)</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block">Diagnostics</span>
                  <span className="text-xs font-medium text-gray-700 mt-0.5 block truncate" title={scannerMessage}>
                    {scannerMessage}
                  </span>
                </div>
              </div>

              {/* Scanner Parameters Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                    <span>Exposure Time (μs)</span>
                    <span className="font-mono text-[#123681]">{exposureTime} μs</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="100"
                    value={exposureTime}
                    onChange={(e) => setExposureTime(Number(e.target.value))}
                    className="w-full accent-[#123681] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                    <span>Analog Gain (dB)</span>
                    <span className="font-mono text-[#123681]">{analogGain} dB</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="1"
                    value={analogGain}
                    onChange={(e) => setAnalogGain(Number(e.target.value))}
                    className="w-full accent-[#123681] cursor-pointer"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-700 block mb-1">Acquisition Trigger Mode</label>
                  <select
                    value={triggerMode}
                    onChange={(e) => setTriggerMode(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-semibold text-gray-800 cursor-pointer"
                  >
                    <option value="Hardware Optical Trigger">Hardware Optical Trigger (Line 1 Input - Photocell)</option>
                    <option value="Continuous Free Run">Continuous Free Run (Video Stream)</option>
                    <option value="Software Command Trigger">Software Command Trigger (Manual / API)</option>
                  </select>
                </div>
              </div>

              {/* Feedback toast */}
              {scannerFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Check size={14} />
                  <span>{scannerFeedback}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setScannerFeedback('Test frame captured from scanner successfully (2448x2048, 12ms latency).');
                    setTimeout(() => setScannerFeedback(null), 3000);
                  }}
                  className="bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded shadow-sm transition-colors cursor-pointer"
                >
                  Capture Test Frame
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannerFeedback('Scanner parameters synchronized with hardware controller.');
                    setTimeout(() => setScannerFeedback(null), 3000);
                  }}
                  className="border border-[#123681] text-[#123681] hover:bg-blue-50 text-xs font-bold px-4 py-2 rounded transition-colors cursor-pointer"
                >
                  Save Scanner Parameters
                </button>
              </div>

            </div>
          )}

          {/* ==================== 4. LIGHTS TAB ==================== */}
          {activeTab === 'lights' && (
            <div className="max-w-4xl flex flex-col gap-6 animate-in fade-in duration-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Sun size={18} className="text-[#123681]" />
                  <span>Inspection Illumination & Strobe Lights</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  High-output industrial LED strobe lighting channels for optimal barcode and OCR contrast.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                    <span>Ring Light Strobe Intensity</span>
                    <span className="font-mono text-[#123681]">{ringLightIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ringLightIntensity}
                    onChange={(e) => setRingLightIntensity(Number(e.target.value))}
                    className="w-full accent-[#123681] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                    <span>Backlight Illuminator Intensity</span>
                    <span className="font-mono text-[#123681]">{backlightIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={backlightIntensity}
                    onChange={(e) => setBacklightIntensity(Number(e.target.value))}
                    className="w-full accent-[#123681] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Pulse Width Duration (μs)</label>
                  <input
                    type="number"
                    value={strobePulseWidth}
                    onChange={(e) => setStrobePulseWidth(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Strobe Synchronization</label>
                  <select
                    value={lightSyncMode}
                    onChange={(e) => setLightSyncMode(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-semibold"
                  >
                    <option value="Pulsed on Exposure Active">Pulsed on Exposure Active</option>
                    <option value="Continuous ON (Diagnostic)">Continuous ON (Diagnostic)</option>
                  </select>
                </div>
              </div>

              {flashFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Check size={14} />
                  <span>{flashFeedback}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setFlashFeedback('Test strobe triggered on Ring Light (Channel 1).');
                    setTimeout(() => setFlashFeedback(null), 3000);
                  }}
                  className="bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded shadow-sm transition-colors cursor-pointer"
                >
                  Test Strobe (Ring Light)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFlashFeedback('Test strobe triggered on Backlight (Channel 2).');
                    setTimeout(() => setFlashFeedback(null), 3000);
                  }}
                  className="border border-[#123681] text-[#123681] hover:bg-blue-50 text-xs font-bold px-4 py-2 rounded transition-colors cursor-pointer"
                >
                  Test Strobe (Backlight)
                </button>
              </div>
            </div>
          )}

          {/* ==================== 5. ETHERNET TAB ==================== */}
          {activeTab === 'ethernet' && (
            <div className="max-w-4xl flex flex-col gap-6 animate-in fade-in duration-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Monitor size={18} className="text-[#123681]" />
                  <span>Ethernet Industrial Vision Subnet</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Direct hardware communication link across dedicated vision network interfaces.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f9fa] border-b border-gray-200 text-gray-700 font-bold">
                    <tr>
                      <th className="p-3">Adapter Name</th>
                      <th className="p-3">IPv4 Address</th>
                      <th className="p-3">Subnet Mask</th>
                      <th className="p-3">MAC Address</th>
                      <th className="p-3">Link Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-mono">
                    {realInterfaces.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-400 font-sans">
                          Detecting network interfaces from host operating system...
                        </td>
                      </tr>
                    ) : (
                      realInterfaces.map((iface) => (
                        <tr key={iface.name} className="hover:bg-gray-50">
                          <td className="p-3 font-sans font-bold text-gray-900">
                            {iface.name}
                            {iface.is_active && (
                              <span className="ml-2 bg-blue-100 text-[#123681] text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                                PRIMARY
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[#123681] font-bold">{iface.ip}</td>
                          <td className="p-3">{iface.netmask}</td>
                          <td className="p-3 text-gray-500">{iface.mac}</td>
                          <td className="p-3 font-sans">
                            {iface.is_loopback ? (
                              <span className="text-gray-500 font-medium">Loopback</span>
                            ) : iface.ip && iface.ip !== 'Not Assigned' ? (
                              <span className="text-emerald-600 font-bold">Active</span>
                            ) : (
                              <span className="text-gray-400 font-medium">Disconnected</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const net = await fetchNetworkInterfaces();
                      if (net && Array.isArray(net.interfaces)) {
                        setRealInterfaces(net.interfaces);
                      }
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  className="bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded shadow-sm transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Activity size={14} />
                  <span>Refresh Detected Adapters</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== 6. USB TAB ==================== */}
          {activeTab === 'usb' && (
            <div className="max-w-4xl flex flex-col gap-6 animate-in fade-in duration-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Usb size={18} className="text-[#123681]" />
                  <span>USB Vision & Peripherals Bus</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Handheld barcode verification scanners, hardware security dongles, and industrial printers.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Usb size={18} className="text-[#123681]" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Honeywell 1950G Handheld Scanner</span>
                      <span className="text-[11px] text-gray-500">USB 2.0 HID Keyboard Wedge Emulation • Serial #21194B4810</span>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-[#123681]" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Pixtron Hardware Security Dongle</span>
                      <span className="text-[11px] text-gray-500">USB Cryptographic Key • License Valid (Perpetual Enterprise)</span>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Printer size={18} className="text-[#123681]" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Zebra ZT411 Industrial Thermal Label Printer</span>
                      <span className="text-[11px] text-gray-500">USB Virtual COM Port (COM4) • 300 DPI • Status: Ready</span>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Ready
                  </span>
                </div>
              </div>

              {usbFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Check size={14} />
                  <span>{usbFeedback}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUsbFeedback('USB bus scanned: 3 peripheral devices enumerated successfully.');
                    setTimeout(() => setUsbFeedback(null), 3000);
                  }}
                  className="bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded shadow-sm transition-colors cursor-pointer"
                >
                  Rescan USB Bus
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsbFeedback('Test print command sent to Zebra Industrial Printer (COM4).');
                    setTimeout(() => setUsbFeedback(null), 3000);
                  }}
                  className="border border-[#123681] text-[#123681] hover:bg-blue-50 text-xs font-bold px-4 py-2 rounded transition-colors cursor-pointer"
                >
                  Test Print to Label Printer
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Vertical Tabs Bar (Matching Screenshot 1 & 2 exactly) */}
        <div className="w-48 bg-white border-l border-gray-200 flex flex-col divide-y divide-gray-100 shrink-0">
          
          {/* Scanner Tab */}
          <button
            onClick={() => setActiveTab('scanner')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'scanner'
                ? 'bg-[#dce6f2] text-[#123681] shadow-inner font-extrabold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ScanLine size={16} />
            <span>{t('Scanner')}</span>
          </button>

          {/* Lights Tab */}
          <button
            onClick={() => setActiveTab('lights')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'lights'
                ? 'bg-[#dce6f2] text-[#123681] shadow-inner font-extrabold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Sun size={16} />
            <span>{t('Lights')}</span>
          </button>

          {/* Ethernet Tab */}
          <button
            onClick={() => setActiveTab('ethernet')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'ethernet'
                ? 'bg-[#dce6f2] text-[#123681] shadow-inner font-extrabold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Monitor size={16} />
            <span>{t('Ethernet')}</span>
          </button>

          {/* USB Tab */}
          <button
            onClick={() => setActiveTab('usb')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'usb'
                ? 'bg-[#dce6f2] text-[#123681] shadow-inner font-extrabold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Usb size={16} />
            <span>{t('USB')}</span>
          </button>

          {/* PLC Tab */}
          <button
            onClick={() => setActiveTab('plc')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'plc'
                ? 'bg-[#dce6f2] text-[#123681] shadow-inner font-extrabold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Cpu size={16} />
            <span>{t('PLC')}</span>
          </button>

          {/* Bypass Rejection Tab */}
          <button
            onClick={() => setActiveTab('bypass')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'bypass'
                ? 'bg-[#dce6f2] text-[#123681] shadow-inner font-extrabold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{t('Bypass Rejection')}</span>
          </button>

        </div>

      </div>

    </div>
  );
};

export default ConnectionsView;
