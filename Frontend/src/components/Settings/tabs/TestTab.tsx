import React, { useState, useEffect } from 'react';
import { runComponentTest, fetchSystemInfo } from '../../../services/api';
import { auditLogger } from '../../../services/auditLogger';
import { Loader2 } from 'lucide-react';

import { getCachedSystemInfo } from '../../../services/settingsStore';

interface ComponentState {
  status: 'OK' | 'NOT_CONNECTED';
  message: string;
}

const TestTab: React.FC = () => {
  const cached = getCachedSystemInfo();
  const [testingAll, setTestingAll] = useState(false);
  const [testingSingle, setTestingSingle] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState('');

  const [components, setComponents] = useState<Record<string, ComponentState>>({
    scanner: {
      status: 'NOT_CONNECTED',
      message: 'No physical scanner detected',
    },
    network: {
      status: 'OK',
      message: cached?.ip_address ? `IP: ${cached.ip_address}` : 'Detecting network adapter...',
    },
    storage: {
      status: 'OK',
      message: cached?.disk_space ? `Disk: ${cached.disk_space}` : 'Checking storage...',
    },
    plc: {
      status: 'NOT_CONNECTED',
      message: 'Modbus TCP socket offline (192.168.125.1:502)',
    },
    sensor: {
      status: 'NOT_CONNECTED',
      message: 'Sensor not connected - integration not available',
    },
  });

  // On mount, run genuine hardware diagnostics on all components
  useEffect(() => {
    handleTestAll();
  }, []);

  const handleTestAll = async () => {
    setTestingAll(true);
    auditLogger.logAction('Test Diagnostics', 'test.run_all', 'Initiated diagnostics for all connected components');

    try {
      // 1. Run real backend hardware diagnostics
      const res = await runComponentTest('all');
      const backendComps = res.components || {};

      setComponents((prev) => {
        const next = { ...prev };

        // Scanner / Camera: ONLY OK if physical scanner is actually connected to hardware port
        if (backendComps.scanner) {
          next.scanner = {
            status: backendComps.scanner.healthy ? 'OK' : 'NOT_CONNECTED',
            message: backendComps.scanner.message || (backendComps.scanner.healthy ? 'Data Matrix 220 connected' : 'Physical scanner offline'),
          };
        } else {
          next.scanner = {
            status: 'NOT_CONNECTED',
            message: 'No physical scanner detected',
          };
        }

        // Network
        if (backendComps.network) {
          next.network = {
            status: backendComps.network.healthy ? 'OK' : 'NOT_CONNECTED',
            message: backendComps.network.message || prev.network.message,
          };
        }

        // Storage
        if (backendComps.storage) {
          next.storage = {
            status: backendComps.storage.healthy ? 'OK' : 'NOT_CONNECTED',
            message: backendComps.storage.message || prev.storage.message,
          };
        }

        // PLC
        if (backendComps.plc) {
          next.plc = {
            status: backendComps.plc.healthy ? 'OK' : 'NOT_CONNECTED',
            message: backendComps.plc.message || prev.plc.message,
          };
        }

        // Sensor: only OK when physical sensor is connected
        if (backendComps.sensor) {
          next.sensor = {
            status: backendComps.sensor.healthy ? 'OK' : 'NOT_CONNECTED',
            message: backendComps.sensor.message || prev.sensor.message,
          };
        }

        return next;
      });
    } catch (err) {
      console.error('Diagnostic test failed:', err);
    } finally {
      setTestingAll(false);
    }
  };

  const handleRunSingleTest = async () => {
    if (!selectedComponent) return;

    setTestingSingle(true);
    auditLogger.logAction('Test Diagnostics', 'test.run_single', `Ran diagnostic for component: ${selectedComponent}`, {
      component: selectedComponent,
    });

    try {
      const res = await runComponentTest(selectedComponent);
      const compData = res.components?.[selectedComponent];

      if (compData) {
        setComponents((prev) => ({
          ...prev,
          [selectedComponent]: {
            status: compData.healthy ? 'OK' : 'NOT_CONNECTED',
            message: compData.message || (compData.healthy ? 'Connected and operational' : 'Hardware not connected'),
          },
        }));
      }
    } catch (err) {
      console.error(`Test for ${selectedComponent} failed:`, err);
    } finally {
      setTestingSingle(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-[#153472] mb-2">Test</h2>
      <p className="text-sm text-gray-500 mb-6">Run system tests and diagnostics for troubleshooting.</p>

      <div className="mb-6">
        <h3 className="text-md font-bold text-gray-700 mb-3">Test All Components</h3>
        <button 
          type="button"
          onClick={handleTestAll}
          disabled={testingAll}
          className="bg-[#153472] hover:bg-blue-900 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors text-sm mb-2 flex items-center gap-2"
        >
          {testingAll && <Loader2 className="animate-spin" size={14} />}
          <span>Test All Connected Components</span>
        </button>
        <p className="text-xs text-gray-500">This will test all connected components: Scanner, PLC, Sensor, Network, and Storage.</p>
      </div>

      <div className="mb-8">
        <h3 className="text-md font-bold text-gray-700 mb-3">Component Status</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Scanner */}
          <div className={`border ${components.scanner.status === 'OK' ? 'border-green-300' : 'border-red-300'} rounded-md p-4 bg-white relative transition-colors`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-gray-800">Scanner</h4>
              <span className={`text-xs font-bold ${components.scanner.status === 'OK' ? 'text-green-500' : 'text-red-500'} uppercase`}>
                {components.scanner.status === 'OK' ? 'OK' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{components.scanner.message}</p>
          </div>
          
          {/* Network */}
          <div className={`border ${components.network.status === 'OK' ? 'border-green-300' : 'border-red-300'} rounded-md p-4 bg-white relative transition-colors`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-gray-800">Network</h4>
              <span className={`text-xs font-bold ${components.network.status === 'OK' ? 'text-green-500' : 'text-red-500'} uppercase`}>
                {components.network.status === 'OK' ? 'OK' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{components.network.message}</p>
          </div>
          
          {/* Storage */}
          <div className={`border ${components.storage.status === 'OK' ? 'border-green-300' : 'border-red-300'} rounded-md p-4 bg-white relative transition-colors`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-gray-800">Storage</h4>
              <span className={`text-xs font-bold ${components.storage.status === 'OK' ? 'text-green-500' : 'text-red-500'} uppercase`}>
                {components.storage.status === 'OK' ? 'OK' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{components.storage.message}</p>
          </div>

          {/* PLC */}
          <div className={`border ${components.plc.status === 'OK' ? 'border-green-300' : 'border-red-300'} rounded-md p-4 bg-white relative transition-colors`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-gray-800">Plc</h4>
              <span className={`text-xs font-bold ${components.plc.status === 'OK' ? 'text-green-500' : 'text-red-500'} uppercase`}>
                {components.plc.status === 'OK' ? 'OK' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{components.plc.message}</p>
          </div>

          {/* Sensor */}
          <div className={`border ${components.sensor.status === 'OK' ? 'border-green-300' : 'border-red-300'} rounded-md p-4 bg-white relative transition-colors`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-gray-800">Sensor</h4>
              <span className={`text-xs font-bold ${components.sensor.status === 'OK' ? 'text-green-500' : 'text-red-500'} uppercase`}>
                {components.sensor.status === 'OK' ? 'OK' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{components.sensor.message}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-md font-bold text-gray-700 mb-3">Individual Component Test</h3>
        <div className="flex gap-4">
          <select 
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#153472]"
          >
            <option value="">Select component to test...</option>
            <option value="scanner">Scanner</option>
            <option value="plc">PLC</option>
            <option value="sensor">Sensor</option>
            <option value="network">Network</option>
            <option value="storage">Storage</option>
          </select>
          <button 
            type="button"
            onClick={handleRunSingleTest}
            disabled={!selectedComponent || testingSingle}
            className="bg-[#153472] hover:bg-blue-900 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors text-sm whitespace-nowrap flex items-center gap-2"
          >
            {testingSingle && <Loader2 className="animate-spin" size={14} />}
            <span>Run Selected Test</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestTab;
