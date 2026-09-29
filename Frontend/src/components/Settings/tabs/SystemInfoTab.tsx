import React, { useState, useEffect } from 'react';
import { fetchSystemInfo } from '../../../services/api';
import { getCachedSystemInfo } from '../../../services/settingsStore';
import { formatDateTime } from '../../../services/dateFormatService';

const SystemInfoTab: React.FC = () => {
  const cached = getCachedSystemInfo();
  const [info, setInfo] = useState<Record<string, any>>(() => {
    if (cached) {
      return {
        ...cached,
        display_resolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '1920x1080',
      };
    }
    return {
      device_name: 'Detecting...',
      platform: 'Detecting...',
      architecture: 'Detecting...',
      processor: 'Detecting...',
      python_version: 'Detecting...',
      current_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      boot_time: 'Detecting...',
      system_uptime: 'Detecting...',
      cpu_cores_physical: '...',
      cpu_cores_logical: '...',
      total_ram: '...',
      free_ram: '...',
      disk_space: '...',
      display_resolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '1920x1080',
      network_adapter: 'Detecting...',
      mac_address: 'Detecting...',
    };
  });

  useEffect(() => {
    const loadRealInfo = async () => {
      try {
        const data = await fetchSystemInfo();
        if (data) {
          setInfo((prev) => ({
            ...prev,
            ...data,
            display_resolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '1920x1080',
          }));
        }
      } catch (err) {
        console.warn('Could not detect host system info:', err);
      }
    };
    loadRealInfo();
  }, []);

  return (
    <div className="max-w-5xl pb-10">
      <h2 className="text-2xl font-bold text-[#153472] mb-2">System Info</h2>
      <p className="text-sm text-gray-500 mb-6">View system information and hardware details.</p>

      <div className="grid grid-cols-2 gap-4">
          {/* Row 1 */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Device Name</div>
            <div className="text-md font-bold text-[#153472]">{info.device_name}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Platform</div>
            <div className="text-md font-bold text-[#153472]">{info.platform}</div>
          </div>

          {/* Row 2 */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Architecture</div>
            <div className="text-md font-bold text-[#153472]">{info.architecture}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Processor</div>
            <div className="text-md font-bold text-[#153472]">{info.processor}</div>
          </div>

          {/* Row 3 */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Python Version</div>
            <div className="text-md font-bold text-[#153472]">{info.python_version}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Current Date and Time</div>
            <div className="text-md font-bold text-[#153472]">{formatDateTime(info.current_time) || info.current_time}</div>
          </div>

          {/* Row 4 */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Boot Time</div>
            <div className="text-md font-bold text-[#153472]">{info.boot_time ? formatDateTime(info.boot_time) : 'N/A'}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">System Uptime</div>
            <div className="text-md font-bold text-[#153472]">{info.system_uptime || 'N/A'}</div>
          </div>

          {/* Row 5 */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">CPU Cores (Physical)</div>
            <div className="text-md font-bold text-[#153472]">{info.cpu_cores_physical || 'N/A'}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">CPU Cores (Logical)</div>
            <div className="text-md font-bold text-[#153472]">{info.cpu_cores_logical || 'N/A'}</div>
          </div>

          {/* Additional Points Below (As requested) */}
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Total Memory (RAM)</div>
            <div className="text-md font-bold text-[#153472]">{info.total_ram}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Free Memory</div>
            <div className="text-md font-bold text-[#153472]">{info.free_ram}</div>
          </div>

          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Disk Space (C:)</div>
            <div className="text-md font-bold text-[#153472]">{info.disk_space}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Display Resolution</div>
            <div className="text-md font-bold text-[#153472]">{info.display_resolution}</div>
          </div>

          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Network Adapter</div>
            <div className="text-md font-bold text-[#153472]">{info.network_adapter}</div>
          </div>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">MAC Address</div>
            <div className="text-md font-bold text-[#153472]">{info.mac_address}</div>
          </div>
        </div>
    </div>
  );
};

export default SystemInfoTab;
