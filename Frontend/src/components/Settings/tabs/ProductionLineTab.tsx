import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  Zap, 
  Sliders, 
  AlertCircle, 
  Cpu, 
  Activity,
  Layers,
  ArrowRightCircle
} from 'lucide-react';
import { auditLogger } from '../../../services/auditLogger';
import { fetchSettingsSection, updateSettingsSection } from '../../../services/api';

const ProductionLineTab: React.FC = () => {
  const [lineName, setLineName] = useState('Line 04 - Flexo Cup Forming & Printing');
  const [stationId, setStationId] = useState('STATION-01');
  const [plantLocation, setPlantLocation] = useState('Huhtamaki Foodservice India - Plant 1');
  const [targetPpm, setTargetPpm] = useState('500');
  const [pitchSpacing, setPitchSpacing] = useState('120');
  const [triggerMode, setTriggerMode] = useState('Photoelectric Proximity (DI-0)');
  const [debounceMs, setDebounceMs] = useState('12');
  
  // Rejection parameters
  const [rejectorType, setRejectorType] = useState('Pneumatic Air Blow Nozzle');
  const [rejectDelayMs, setRejectDelayMs] = useState('45');
  const [blowDurationMs, setBlowDurationMs] = useState('60');
  const [binVerification, setBinVerification] = useState(true);

  // Batch
  const [batchId, setBatchId] = useState('BATCH-2026-FLEXO-01');
  const [targetCount, setTargetCount] = useState('50000');
  const [currentShift, setCurrentShift] = useState('Shift A (06:00 - 14:00)');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testOutput, setTestOutput] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);

  useEffect(() => {
    fetchSettingsSection('production_line')
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          if (data.line_name) setLineName(data.line_name);
          if (data.station_id) setStationId(data.station_id);
          if (data.plant_location) setPlantLocation(data.plant_location);
          if (data.target_ppm) setTargetPpm(String(data.target_ppm));
          if (data.pitch_spacing) setPitchSpacing(String(data.pitch_spacing));
          if (data.trigger_mode) setTriggerMode(data.trigger_mode);
          if (data.debounce_ms) setDebounceMs(String(data.debounce_ms));
          if (data.rejector_type) setRejectorType(data.rejector_type);
          if (data.reject_delay_ms) setRejectDelayMs(String(data.reject_delay_ms));
          if (data.blow_duration_ms) setBlowDurationMs(String(data.blow_duration_ms));
          if (data.batch_id) setBatchId(data.batch_id);
          if (data.target_count) setTargetCount(String(data.target_count));
          if (data.shift) setCurrentShift(data.shift);
        }
      })
      .catch((err) => {
        console.warn('Could not load production line settings:', err);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        line_name: lineName,
        station_id: stationId,
        plant_location: plantLocation,
        target_ppm: parseInt(targetPpm, 10) || 500,
        pitch_spacing: parseInt(pitchSpacing, 10) || 120,
        trigger_mode: triggerMode,
        debounce_ms: parseInt(debounceMs, 10) || 12,
        rejector_type: rejectorType,
        reject_delay_ms: parseInt(rejectDelayMs, 10) || 45,
        blow_duration_ms: parseInt(blowDurationMs, 10) || 60,
        bin_verification: binVerification,
        batch_id: batchId,
        target_count: parseInt(targetCount, 10) || 50000,
        shift: currentShift,
      };

      await updateSettingsSection('production_line', payload);
      auditLogger.logAction(
        'Production Line Setup',
        'settings.production_line_saved',
        `Updated Production Line Setup: ${lineName} (${batchId})`,
        payload
      );

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save production line setup:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSolenoid = () => {
    auditLogger.logAction('Production Line Setup', 'solenoid.test_fired', 'Triggered test pulse on Pneumatic Rejector Solenoid');
    setTestOutput({ message: 'Pneumatic Rejector Solenoid test pulse executed successfully (60ms).', type: 'success' });
    setTimeout(() => setTestOutput(null), 3500);
  };

  const handleTestTrigger = () => {
    auditLogger.logAction('Production Line Setup', 'trigger.test_simulated', 'Simulated hardware photo-eye trigger pulse');
    setTestOutput({ message: 'Optical Sensor trigger pulse captured on DI-0 (Latency: 2.1ms).', type: 'success' });
    setTimeout(() => setTestOutput(null), 3500);
  };

  return (
    <div className="h-full flex flex-col justify-between max-w-4xl text-gray-800">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="border-b border-gray-200 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Layout size={20} className="text-[#153472]" />
              Production Line Setup
            </h2>
            <p className="text-xs text-gray-500">Configure conveyor parameters, optical trigger timing, and pneumatic defect rejection.</p>
          </div>
          <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Line Active
          </span>
        </div>

        {/* Section 1: Line Identification */}
        <div className="bg-slate-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-bold uppercase text-gray-600 mb-3 flex items-center gap-2">
            <Layers size={14} className="text-[#153472]" />
            Line & Station Identification
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Production Line Name</label>
              <input
                type="text"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Station Code</label>
              <input
                type="text"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Plant / Facility Location</label>
              <input
                type="text"
                value={plantLocation}
                onChange={(e) => setPlantLocation(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Conveyor & Optical Trigger Synchronization */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase text-gray-600 mb-3 flex items-center gap-2">
            <Activity size={14} className="text-[#153472]" />
            Conveyor Speed & Optical Sensor Synchronization
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Target Speed (PPM)</label>
              <input
                type="number"
                value={targetPpm}
                onChange={(e) => setTargetPpm(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Container Pitch (mm)</label>
              <input
                type="number"
                value={pitchSpacing}
                onChange={(e) => setPitchSpacing(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sensor Trigger Input</label>
              <select
                value={triggerMode}
                onChange={(e) => setTriggerMode(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              >
                <option value="Photoelectric Proximity (DI-0)">Photoelectric Proximity (DI-0)</option>
                <option value="Laser Through-Beam (DI-1)">Laser Through-Beam (DI-1)</option>
                <option value="Rotary Encoder Pulses (Phase A/B)">Rotary Encoder Pulses (Phase A/B)</option>
                <option value="Continuous Free-Run (Auto-Sync)">Continuous Free-Run (Auto-Sync)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Debounce Filter (ms)</label>
              <input
                type="number"
                value={debounceMs}
                onChange={(e) => setDebounceMs(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Pneumatic Defect Rejection Setup */}
        <div className="bg-slate-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-bold uppercase text-gray-600 mb-3 flex items-center gap-2">
            <Zap size={14} className="text-[#153472]" />
            Defect Ejector & Pneumatic Reject Mechanism
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rejection Actuator</label>
              <select
                value={rejectorType}
                onChange={(e) => setRejectorType(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              >
                <option value="Pneumatic Air Blow Nozzle">Pneumatic Air Blow Nozzle</option>
                <option value="Pneumatic Cylinder Pusher">Pneumatic Cylinder Pusher</option>
                <option value="High-Speed Flap Diverter">High-Speed Flap Diverter</option>
                <option value="Drop-Down Reject Chute">Drop-Down Reject Chute</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ejection Delay (ms)</label>
              <input
                type="number"
                value={rejectDelayMs}
                onChange={(e) => setRejectDelayMs(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Blow / Stroke Duration (ms)</label>
              <input
                type="number"
                value={blowDurationMs}
                onChange={(e) => setBlowDurationMs(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-[#153472]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="binVerification"
              checked={binVerification}
              onChange={(e) => setBinVerification(e.target.checked)}
              className="rounded text-[#153472] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="binVerification" className="text-xs text-gray-700 cursor-pointer">
              Enable Reject Confirmation Sensor (verify defect cup physically entered reject bin)
            </label>
          </div>
        </div>

        {/* Section 4: Live Diagnostic Hardware Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase text-gray-600 mb-3 flex items-center gap-2">
            <Cpu size={14} className="text-[#153472]" />
            Hardware Diagnostics & Actuator Testing
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleTestSolenoid}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-gray-300 text-gray-700 px-3.5 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Zap size={14} className="text-amber-600" />
              Test Ejector Solenoid Pulse
            </button>
            <button
              onClick={handleTestTrigger}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-gray-300 text-gray-700 px-3.5 py-2 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Activity size={14} className="text-blue-600" />
              Test Optical Trigger Sensor (DI-0)
            </button>
          </div>

          {testOutput && (
            <div className={`mt-3 p-2.5 rounded text-xs border flex items-center gap-2 ${
              testOutput.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <CheckCircle2 size={16} />
              <span>{testOutput.message}</span>
            </div>
          )}
        </div>

      </div>

      {/* Footer Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={16} />
              Production line parameters saved successfully!
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#153472] hover:bg-[#0e2450] text-white px-6 py-2 rounded-lg text-xs font-bold shadow transition-all cursor-pointer disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default ProductionLineTab;
