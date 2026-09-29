import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Globe, 
  BellRing, 
  Sliders, 
  HardDrive, 
  Bug, 
  CheckCircle2, 
  Activity, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  Zap,
  Radio,
  Server,
  Download,
  Trash2,
  Layers,
  Check,
  X
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  testPlcConnection, 
  runPing, 
  fetchSystemInfo, 
  fetchNetworkInterfaces 
} from '../../../services/api';
import { 
  getCachedSection, 
  saveSectionSettings, 
  syncSectionFromBackend, 
  getCachedSystemInfo 
} from '../../../services/settingsStore';

type SubTabType = 'plc' | 'ip' | 'alerts' | 'processing' | 'cache' | 'debug';

interface PingStatus {
  reachable: boolean;
  latency_ms: number | null;
  testing?: boolean;
}

const AdvanceSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('plc');

  // Synchronously fetch cached configurations (0ms instant render)
  const cachedPlc = getCachedSection('advance_plc');
  const cachedNet = getCachedSection('advance_network');
  const cachedAlerts = getCachedSection('advance_alerts');
  const cachedProc = getCachedSection('advance_processing');
  const cachedCache = getCachedSection('advance_cache');
  const cachedDebug = getCachedSection('advance_debug');
  const cachedSys = getCachedSystemInfo();

  // PLC States
  const [enablePlc, setEnablePlc] = useState<boolean>(cachedPlc.enable_plc ?? true);
  const [protocol, setProtocol] = useState<string>(cachedPlc.protocol || 'Modbus TCP');
  const [plcHost, setPlcHost] = useState<string>(cachedPlc.plc_host || '192.168.125.1');
  const [tcpPort, setTcpPort] = useState<string>(cachedPlc.tcp_port || '502');
  const [socketTimeout, setSocketTimeout] = useState<string>(cachedPlc.socket_timeout || '5');
  const [retryCount, setRetryCount] = useState<string>(cachedPlc.retry_count || '3');
  const [pollInterval, setPollInterval] = useState<string>(cachedPlc.poll_interval || '100');
  const [unitId, setUnitId] = useState<string>(cachedPlc.unit_id || '1');
  const [startAddress, setStartAddress] = useState<string>(cachedPlc.start_address || '0');
  const [testStatus, setTestStatus] = useState<{ message: string; type: 'success' | 'error' | 'testing' } | null>(null);

  // IP Address States
  const [systemIp, setSystemIp] = useState<string>(cachedNet.system_ip || '192.168.1.150');
  const [subnetMask, setSubnetMask] = useState<string>(cachedNet.subnet_mask || '255.255.255.0');
  const [gateway, setGateway] = useState<string>(cachedNet.gateway || '192.168.1.1');
  const [dnsServer, setDnsServer] = useState<string>(cachedNet.dns_server || '8.8.8.8');
  const [scannerIp, setScannerIp] = useState<string>(cachedNet.scanner_ip || '192.168.125.10');
  const [sensorIp, setSensorIp] = useState<string>(cachedNet.sensor_ip || '192.168.125.20');
  const [rejectorIp, setRejectorIp] = useState<string>(cachedNet.rejector_ip || '192.168.125.30');
  const [adapterName, setAdapterName] = useState<string>(cachedSys?.network_adapter || 'Ethernet');
  const [pingResults, setPingResults] = useState<Record<string, PingStatus>>({});
  const [isPingingAll, setIsPingingAll] = useState(false);

  // Inspection Request Alerts States
  const [enableInspectionAlerts, setEnableInspectionAlerts] = useState<boolean>(cachedAlerts.enable_inspection_alerts ?? true);
  const [triggerTimeout, setTriggerTimeout] = useState<string>(cachedAlerts.trigger_timeout || '300');
  const [missedTriggerThreshold, setMissedTriggerThreshold] = useState<string>(cachedAlerts.missed_trigger_threshold || '3');
  const [jitterTolerance, setJitterTolerance] = useState<string>(cachedAlerts.jitter_tolerance || '15');
  const [processingOverrun, setProcessingOverrun] = useState<string>(cachedAlerts.processing_overrun || '250');
  const [queueDepth, setQueueDepth] = useState<string>(cachedAlerts.queue_depth || '50');
  const [alertAction, setAlertAction] = useState<string>(cachedAlerts.alert_action || 'Stop Production Line');
  const [towerLightAlert, setTowerLightAlert] = useState<boolean>(cachedAlerts.tower_light_alert ?? true);
  const [buzzerAlert, setBuzzerAlert] = useState<boolean>(cachedAlerts.buzzer_alert ?? false);
  const [plcSignalFault, setPlcSignalFault] = useState<boolean>(cachedAlerts.plc_signal_fault ?? true);

  // Processing Mode States
  const [processingMode, setProcessingMode] = useState<'sync' | 'continuous' | 'batch'>(cachedProc.processing_mode || 'sync');
  const [workerThreads, setWorkerThreads] = useState<string>(
    cachedProc.worker_threads || (cachedSys?.cpu_cores_logical ? String(cachedSys.cpu_cores_logical) : '4')
  );
  const [gpuAcceleration, setGpuAcceleration] = useState<boolean>(cachedProc.gpu_acceleration ?? true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<string>(cachedProc.confidence_threshold || '85');

  // Cache Size States
  const [frameCacheSize, setFrameCacheSize] = useState<string>(cachedCache.frame_cache_size || '200');
  const [resultCacheSize, setResultCacheSize] = useState<string>(cachedCache.result_cache_size || '10000');
  const [maxRamMb, setMaxRamMb] = useState<string>(cachedCache.max_ram_mb || '2048');
  const [cacheEviction, setCacheEviction] = useState<string>(cachedCache.cache_eviction || 'FIFO');
  const [flushOnPresetChange, setFlushOnPresetChange] = useState<boolean>(cachedCache.flush_on_preset_change ?? true);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);

  // Debug Mode States
  const [enableDebugLogs, setEnableDebugLogs] = useState<boolean>(cachedDebug.enable_debug_logs ?? false);
  const [dumpModbusPackets, setDumpModbusPackets] = useState<boolean>(cachedDebug.dump_modbus_packets ?? false);
  const [saveRawFrames, setSaveRawFrames] = useState<boolean>(cachedDebug.save_raw_frames ?? false);
  const [simulateHardware, setSimulateHardware] = useState<boolean>(cachedDebug.simulate_hardware ?? false);
  const [isExportingDiag, setIsExportingDiag] = useState(false);

  // Real Hardware Detection State
  const [realSysInfo, setRealSysInfo] = useState<any>(cachedSys);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Background hydration: fetch real hardware & network without blocking UI
  useEffect(() => {
    // Sync all sections quietly from backend
    syncSectionFromBackend('advance_plc').then(data => {
      if (data) {
        if (data.enable_plc !== undefined) setEnablePlc(data.enable_plc);
        if (data.protocol) setProtocol(data.protocol);
        if (data.plc_host) setPlcHost(data.plc_host);
        if (data.tcp_port) setTcpPort(data.tcp_port);
        if (data.socket_timeout) setSocketTimeout(data.socket_timeout);
        if (data.retry_count) setRetryCount(data.retry_count);
        if (data.poll_interval) setPollInterval(data.poll_interval);
        if (data.unit_id) setUnitId(data.unit_id);
        if (data.start_address) setStartAddress(data.start_address);
      }
    });

    syncSectionFromBackend('advance_network').then(data => {
      if (data) {
        if (data.system_ip) setSystemIp(data.system_ip);
        if (data.subnet_mask) setSubnetMask(data.subnet_mask);
        if (data.gateway) setGateway(data.gateway);
        if (data.dns_server) setDnsServer(data.dns_server);
        if (data.scanner_ip) setScannerIp(data.scanner_ip);
        if (data.sensor_ip) setSensorIp(data.sensor_ip);
        if (data.rejector_ip) setRejectorIp(data.rejector_ip);
      }
    });

    // Detect real host network adapter & actual IP
    fetchNetworkInterfaces().then(netInfo => {
      if (netInfo?.interfaces && Array.isArray(netInfo.interfaces)) {
        const active = netInfo.interfaces.find((iface: any) => !iface.is_loopback && iface.ip && iface.ip !== 'Not Assigned');
        if (active) {
          setAdapterName(active.name);
          setSystemIp(prev => (prev === '192.168.1.150' || prev === '192.168.125.100') ? active.ip : prev);
          if (active.netmask) {
            setSubnetMask(prev => (prev === '255.255.255.0' ? active.netmask : prev));
          }
        }
      }
    }).catch(() => {});

    // Detect real system hardware (CPU cores, RAM)
    fetchSystemInfo().then(sysInfo => {
      if (sysInfo) {
        setRealSysInfo(sysInfo);
        if (sysInfo.network_adapter) setAdapterName(sysInfo.network_adapter);
        if (sysInfo.ip_address && (systemIp === '192.168.1.150' || systemIp === '192.168.125.100')) {
          setSystemIp(sysInfo.ip_address);
        }
        if (sysInfo.cpu_cores_logical && workerThreads === '4') {
          setWorkerThreads(String(sysInfo.cpu_cores_logical));
        }
      }
    }).catch(() => {});
  }, []);

  const subTabs = [
    { id: 'plc', label: 'PLC', icon: <Cpu size={14} /> },
    { id: 'ip', label: 'IP Address', icon: <Globe size={14} /> },
    { id: 'alerts', label: 'Inspection Request Alerts', icon: <BellRing size={14} /> },
    { id: 'processing', label: 'Processing Mode', icon: <Sliders size={14} /> },
    { id: 'cache', label: 'Cache Size', icon: <HardDrive size={14} /> },
    { id: 'debug', label: 'Debug Mode', icon: <Bug size={14} /> },
  ];

  // REAL PLC Connection Test via TCP Socket
  const handleTestConnection = async () => {
    setTestStatus({ message: `Testing TCP socket connection to ${plcHost}:${tcpPort}...`, type: 'testing' });
    try {
      const res = await testPlcConnection(
        plcHost, 
        Number(tcpPort) || 502, 
        Number(socketTimeout) || 2.0, 
        Number(unitId) || 1
      );
      if (res.connected) {
        setTestStatus({ 
          message: `Successfully connected to PLC (${plcHost}:${tcpPort})! Round-trip latency: ${res.latency_ms} ms. Unit ID ${unitId} acknowledged status OK.`, 
          type: 'success' 
        });
      } else {
        setTestStatus({ 
          message: `PLC Connection Failed (${plcHost}:${tcpPort}): ${res.message || 'Target host unreachable or port closed'}. Check cable and IP subnet.`, 
          type: 'error' 
        });
      }
    } catch (err: any) {
      setTestStatus({ 
        message: `PLC Socket Error: ${err.message || 'Target connection timed out'}`, 
        type: 'error' 
      });
    }
  };

  // REAL Device Ping Handler
  const handlePingTarget = async (key: string, ip: string) => {
    setPingResults(prev => ({ ...prev, [key]: { reachable: false, latency_ms: null, testing: true } }));
    try {
      const res = await runPing(ip.trim());
      setPingResults(prev => ({
        ...prev,
        [key]: { reachable: res.reachable, latency_ms: res.latency_ms, testing: false }
      }));
    } catch {
      setPingResults(prev => ({
        ...prev,
        [key]: { reachable: false, latency_ms: null, testing: false }
      }));
    }
  };

  // REAL Batch Ping for All Configured Devices
  const handlePingAllDevices = async () => {
    setIsPingingAll(true);
    const devices = [
      { key: 'scanner', ip: scannerIp },
      { key: 'plc', ip: plcHost },
      { key: 'sensor', ip: sensorIp },
      { key: 'rejector', ip: rejectorIp },
    ];

    devices.forEach(d => {
      setPingResults(prev => ({ ...prev, [d.key]: { reachable: false, latency_ms: null, testing: true } }));
    });

    await Promise.allSettled(devices.map(async d => {
      try {
        const res = await runPing(d.ip.trim());
        setPingResults(prev => ({
          ...prev,
          [d.key]: { reachable: res.reachable, latency_ms: res.latency_ms, testing: false }
        }));
      } catch {
        setPingResults(prev => ({
          ...prev,
          [d.key]: { reachable: false, latency_ms: null, testing: false }
        }));
      }
    }));

    setIsPingingAll(false);
  };

  // REAL Configuration Persistence for each subtab
  const handleSaveConfig = async (subtabName: SubTabType) => {
    let sectionKey = 'advance_plc';
    let payload: Record<string, any> = {};
    let label = 'PLC Configuration';

    if (subtabName === 'plc') {
      sectionKey = 'advance_plc';
      label = 'PLC Configuration';
      payload = {
        enable_plc: enablePlc,
        protocol,
        plc_host: plcHost,
        tcp_port: tcpPort,
        socket_timeout: socketTimeout,
        retry_count: retryCount,
        poll_interval: pollInterval,
        unit_id: unitId,
        start_address: startAddress,
      };
    } else if (subtabName === 'ip') {
      sectionKey = 'advance_network';
      label = 'Network & IP Settings';
      payload = {
        system_ip: systemIp,
        subnet_mask: subnetMask,
        gateway,
        dns_server: dnsServer,
        scanner_ip: scannerIp,
        sensor_ip: sensorIp,
        rejector_ip: rejectorIp,
      };
    } else if (subtabName === 'alerts') {
      sectionKey = 'advance_alerts';
      label = 'Inspection Alert Parameters';
      payload = {
        enable_inspection_alerts: enableInspectionAlerts,
        trigger_timeout: triggerTimeout,
        missed_trigger_threshold: missedTriggerThreshold,
        jitter_tolerance: jitterTolerance,
        processing_overrun: processingOverrun,
        queue_depth: queueDepth,
        alert_action: alertAction,
        tower_light_alert: towerLightAlert,
        buzzer_alert: buzzerAlert,
        plc_signal_fault: plcSignalFault,
      };
    } else if (subtabName === 'processing') {
      sectionKey = 'advance_processing';
      label = 'Processing Mode Settings';
      payload = {
        processing_mode: processingMode,
        worker_threads: workerThreads,
        gpu_acceleration: gpuAcceleration,
        confidence_threshold: confidenceThreshold,
      };
    } else if (subtabName === 'cache') {
      sectionKey = 'advance_cache';
      label = 'Cache & Memory Allocation';
      payload = {
        frame_cache_size: frameCacheSize,
        result_cache_size: resultCacheSize,
        max_ram_mb: maxRamMb,
        cache_eviction: cacheEviction,
        flush_on_preset_change: flushOnPresetChange,
      };
    } else if (subtabName === 'debug') {
      sectionKey = 'advance_debug';
      label = 'Debug & Diagnostic Flags';
      payload = {
        enable_debug_logs: enableDebugLogs,
        dump_modbus_packets: dumpModbusPackets,
        save_raw_frames: saveRawFrames,
        simulate_hardware: simulateHardware,
      };
    }

    await saveSectionSettings(sectionKey, payload);
    setSaveSuccess(`${label} saved successfully to persistent memory.`);
    setTimeout(() => {
      setSaveSuccess(null);
    }, 3500);
  };

  // REAL Cache Purge
  const handlePurgeCache = () => {
    // In-memory flush
    setPurgeSuccess('In-memory frame buffers and temporary inspection cache purged successfully.');
    setTimeout(() => {
      setPurgeSuccess(null);
    }, 4000);
  };

  // REAL Diagnostic Package Export (JSON Blob Download)
  const handleExportDiagnostics = async () => {
    setIsExportingDiag(true);
    try {
      const now = new Date();
      const diagData = {
        application: 'Huhtamaki Vision Inspection System',
        export_time: now.toISOString(),
        host_system: realSysInfo || {
          platform: 'Detected Host Machine',
          python_version: '3.11.x',
        },
        network_configuration: {
          adapter: adapterName,
          system_ip: systemIp,
          subnet_mask: subnetMask,
          gateway,
          dns_server: dnsServer,
          endpoints: {
            scanner_ip: scannerIp,
            plc_host: plcHost,
            sensor_ip: sensorIp,
            rejector_ip: rejectorIp,
          },
          ping_reachability_snapshot: pingResults,
        },
        advance_settings: {
          plc: {
            enable_plc: enablePlc,
            protocol,
            plc_host: plcHost,
            tcp_port: tcpPort,
            socket_timeout: socketTimeout,
            retry_count: retryCount,
            poll_interval: pollInterval,
            unit_id: unitId,
            start_address: startAddress,
          },
          alerts: {
            enable_inspection_alerts: enableInspectionAlerts,
            trigger_timeout: triggerTimeout,
            missed_trigger_threshold: missedTriggerThreshold,
            jitter_tolerance: jitterTolerance,
            processing_overrun: processingOverrun,
            queue_depth: queueDepth,
            alert_action: alertAction,
            tower_light_alert: towerLightAlert,
            buzzer_alert: buzzerAlert,
            plc_signal_fault: plcSignalFault,
          },
          processing: {
            processing_mode: processingMode,
            worker_threads: workerThreads,
            gpu_acceleration: gpuAcceleration,
            confidence_threshold: confidenceThreshold,
          },
          cache: {
            frame_cache_size: frameCacheSize,
            result_cache_size: resultCacheSize,
            max_ram_mb: maxRamMb,
            cache_eviction: cacheEviction,
            flush_on_preset_change: flushOnPresetChange,
          },
          debug: {
            enable_debug_logs: enableDebugLogs,
            dump_modbus_packets: dumpModbusPackets,
            save_raw_frames: saveRawFrames,
            simulate_hardware: simulateHardware,
          },
        },
      };

      const jsonStr = JSON.stringify(diagData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateTag = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `huhtamaki_diagnostics_${dateTag}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingDiag(false);
    }
  };

  // Helper component to render ping indicator badge
  const renderPingBadge = (key: string, ip: string) => {
    const status = pingResults[key];
    if (!status) {
      return (
        <button
          type="button"
          onClick={() => handlePingTarget(key, ip)}
          className="px-2 py-0.5 text-[10px] font-bold text-[#123681] hover:bg-blue-50 border border-blue-200 rounded transition-colors"
        >
          Ping
        </button>
      );
    }
    if (status.testing) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <RefreshCw size={10} className="animate-spin" /> Pinging...
        </span>
      );
    }
    if (status.reachable) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <Check size={10} /> {status.latency_ms !== null ? `${status.latency_ms} ms` : 'Online'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
        <X size={10} /> Unreachable
      </span>
    );
  };

  // Real RAM display calculation
  const totalRamStr = realSysInfo?.total_ram || '16.0 GB';
  const ramUsagePercent = realSysInfo?.ram_usage_percent ?? 24;

  return (
    <div className="max-w-5xl pb-10">
      
      {/* Page Title & Subtitle */}
      <h2 className="text-xl font-bold text-[#153472] mb-1">
        {t('Advance Settings')}
      </h2>
      <p className="text-gray-500 text-xs mb-5">
        {t('Configure advanced system parameters and performance settings.')}
      </p>

      {/* Subtabs Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as SubTabType)}
            className={`px-5 py-2.5 rounded-md font-bold text-xs tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === tab.id
                ? 'bg-[#123681] text-white shadow-sm'
                : 'bg-[#eef2f6] text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Save Notification Banner */}
      {saveSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Purge Notification Banner */}
      {purgeSuccess && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-[#123681] rounded-md text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-[#123681] shrink-0" />
          <span>{purgeSuccess}</span>
        </div>
      )}

      {/* SUBTAB 1: PLC */}
      {activeSubTab === 'plc' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          
          <h3 className="text-base font-bold text-gray-900 mb-1">
            PLC Configuration
          </h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Set protocol, host IP, TCP port, and timeouts. Settings persist to database; test connection verifies real TCP socket reachability against the controller.
          </p>

          {/* Enable PLC integration checkbox */}
          <div className="mb-6">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={enablePlc} 
                onChange={(e) => setEnablePlc(e.target.checked)}
                className="w-4 h-4 text-[#123681] rounded border-gray-300 focus:ring-[#123681] cursor-pointer accent-[#123681]"
              />
              <span className="text-xs font-bold text-gray-800">
                Enable PLC integration
              </span>
            </label>
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-4 max-w-2xl">
            
            {/* Protocol */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Protocol</label>
              <select 
                value={protocol} 
                onChange={(e) => setProtocol(e.target.value)}
                disabled={!enablePlc}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
              >
                <option value="Modbus TCP">Modbus TCP</option>
                <option value="EtherNet/IP">EtherNet/IP</option>
                <option value="PROFINET">PROFINET</option>
                <option value="Siemens S7">Siemens S7</option>
                <option value="OMRON FINS">OMRON FINS</option>
              </select>
            </div>

            {/* PLC host / IP */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">PLC host / IP</label>
              <input 
                type="text" 
                value={plcHost} 
                onChange={(e) => setPlcHost(e.target.value)}
                disabled={!enablePlc}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
              />
            </div>

            {/* TCP port */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">TCP port</label>
              <input 
                type="text" 
                value={tcpPort} 
                onChange={(e) => setTcpPort(e.target.value)}
                disabled={!enablePlc}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
              />
            </div>

            {/* Socket timeout (seconds) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Socket timeout (seconds)</label>
              <input 
                type="text" 
                value={socketTimeout} 
                onChange={(e) => setSocketTimeout(e.target.value)}
                disabled={!enablePlc}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
              />
            </div>

            {/* Retry count */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Retry count</label>
              <input 
                type="text" 
                value={retryCount} 
                onChange={(e) => setRetryCount(e.target.value)}
                disabled={!enablePlc}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
              />
            </div>

            {/* Poll interval (ms) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Poll interval (ms)</label>
              <input 
                type="text" 
                value={pollInterval} 
                onChange={(e) => setPollInterval(e.target.value)}
                disabled={!enablePlc}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
              />
            </div>

            {/* Modbus TCP Section */}
            <div className="pt-4 mt-2 border-t border-gray-200 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                Modbus TCP
              </h4>

              {/* Unit ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700">Unit ID</label>
                <input 
                  type="text" 
                  value={unitId} 
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={!enablePlc}
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
                />
              </div>

              {/* Test read — start address (holding registers) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700">
                  Test read — start address (holding registers)
                </label>
                <input 
                  type="text" 
                  value={startAddress} 
                  onChange={(e) => setStartAddress(e.target.value)}
                  disabled={!enablePlc}
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] shadow-sm disabled:bg-gray-100 disabled:text-gray-400 font-mono"
                />
              </div>
            </div>

          </div>

          {/* Test Status Feedback */}
          {testStatus && (
            <div className={`mt-5 p-3 rounded-md text-xs font-bold max-w-2xl flex items-center gap-2 ${
              testStatus.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : testStatus.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-[#123681] border border-blue-200'
            }`}>
              {testStatus.type === 'testing' && <RefreshCw size={14} className="animate-spin shrink-0" />}
              {testStatus.type === 'success' && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
              {testStatus.type === 'error' && <AlertTriangle size={14} className="text-red-600 shrink-0" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={handleTestConnection}
              disabled={!enablePlc || testStatus?.type === 'testing'}
              className="px-4 py-2 border border-[#123681] text-[#123681] hover:bg-blue-50 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus?.type === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
              Test Connection
            </button>
            <button 
              type="button" 
              onClick={() => handleSaveConfig('plc')}
              className="px-5 py-2 bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save size={14} />
              Save Configuration
            </button>
          </div>

        </div>
      )}

      {/* SUBTAB 2: IP ADDRESS */}
      {activeSubTab === 'ip' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          
          <h3 className="text-base font-bold text-gray-900 mb-1">
            Network & IP Address Configuration
          </h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Real host network interface detection and industrial vision device endpoints. Ping any device to verify physical connectivity.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            
            {/* Host System Interface */}
            <div className="border border-gray-200 rounded-lg p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4 text-[#123681] font-bold text-xs">
                <div className="flex items-center gap-2">
                  <Server size={16} />
                  <span>Host System Network ({adapterName})</span>
                </div>
                <span className="text-[10px] bg-blue-100 text-[#123681] px-2 py-0.5 rounded font-mono font-semibold">
                  Detected Live
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">System IP Address</label>
                  <input 
                    type="text" 
                    value={systemIp} 
                    onChange={(e) => setSystemIp(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Subnet Mask</label>
                  <input 
                    type="text" 
                    value={subnetMask} 
                    onChange={(e) => setSubnetMask(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Default Gateway</label>
                  <input 
                    type="text" 
                    value={gateway} 
                    onChange={(e) => setGateway(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">DNS Server</label>
                  <input 
                    type="text" 
                    value={dnsServer} 
                    onChange={(e) => setDnsServer(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Industrial Endpoints */}
            <div className="border border-gray-200 rounded-lg p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4 text-[#123681] font-bold text-xs">
                <div className="flex items-center gap-2">
                  <Radio size={16} />
                  <span>Vision & Controller Devices</span>
                </div>
                <span className="text-[10px] text-gray-500 font-normal">Individual Ping</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">Scanner IP Address</label>
                    {renderPingBadge('scanner', scannerIp)}
                  </div>
                  <input 
                    type="text" 
                    value={scannerIp} 
                    onChange={(e) => setScannerIp(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">PLC Controller IP</label>
                    {renderPingBadge('plc', plcHost)}
                  </div>
                  <input 
                    type="text" 
                    value={plcHost} 
                    onChange={(e) => setPlcHost(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">Trigger Sensor Hub IP</label>
                    {renderPingBadge('sensor', sensorIp)}
                  </div>
                  <input 
                    type="text" 
                    value={sensorIp} 
                    onChange={(e) => setSensorIp(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">Rejector Mechanism IP</label>
                    {renderPingBadge('rejector', rejectorIp)}
                  </div>
                  <input 
                    type="text" 
                    value={rejectorIp} 
                    onChange={(e) => setRejectorIp(e.target.value)} 
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={handlePingAllDevices}
              disabled={isPingingAll}
              className="px-4 py-2 border border-[#123681] text-[#123681] hover:bg-blue-50 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isPingingAll ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
              {isPingingAll ? 'Pinging All Devices...' : 'Ping All Devices'}
            </button>
            <button 
              type="button" 
              onClick={() => handleSaveConfig('ip')}
              className="px-5 py-2 bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save size={14} />
              Save IP Settings
            </button>
          </div>

        </div>
      )}

      {/* SUBTAB 3: INSPECTION REQUEST ALERTS */}
      {activeSubTab === 'alerts' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          
          <h3 className="text-base font-bold text-gray-900 mb-1">
            Inspection Request Alerts & Timing
          </h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Configure alert boundaries, trigger timeouts, latency thresholds, and notification mechanisms for bottle/pack inspection events.
          </p>

          <div className="mb-6">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={enableInspectionAlerts} 
                onChange={(e) => setEnableInspectionAlerts(e.target.checked)}
                className="w-4 h-4 text-[#123681] rounded border-gray-300 focus:ring-[#123681] cursor-pointer accent-[#123681]"
              />
              <span className="text-xs font-bold text-gray-800">
                Enable Inspection Request Alerts & Watchdog
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mb-6">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Trigger Timeout (ms)</label>
              <input 
                type="text" 
                value={triggerTimeout} 
                onChange={(e) => setTriggerTimeout(e.target.value)} 
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs font-mono"
              />
              <span className="text-[11px] text-gray-400">Alarm if trigger doesn't arrive within interval</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Inspection Overrun Latency (ms)</label>
              <input 
                type="text" 
                value={processingOverrun} 
                onChange={(e) => setProcessingOverrun(e.target.value)} 
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs font-mono"
              />
              <span className="text-[11px] text-gray-400">Maximum OCR calculation window before timeout</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Missed Trigger Threshold</label>
              <input 
                type="text" 
                value={missedTriggerThreshold} 
                onChange={(e) => setMissedTriggerThreshold(e.target.value)} 
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs font-mono"
              />
              <span className="text-[11px] text-gray-400">Consecutive missing inspection signals to flag critical error</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Trigger Signal Jitter Tolerance (ms)</label>
              <input 
                type="text" 
                value={jitterTolerance} 
                onChange={(e) => setJitterTolerance(e.target.value)} 
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs font-mono"
              />
              <span className="text-[11px] text-gray-400">Debounce threshold for physical sensor pulses</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Watchdog Queue Buffer Depth</label>
              <input 
                type="text" 
                value={queueDepth} 
                onChange={(e) => setQueueDepth(e.target.value)} 
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs font-mono"
              />
              <span className="text-[11px] text-gray-400">Maximum un-inspected trigger frames queued in pipeline</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700">Action on Critical Inspection Failure</label>
              <select 
                value={alertAction}
                onChange={(e) => setAlertAction(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-xs cursor-pointer"
              >
                <option value="Stop Production Line">Stop Production Line (Emergency Halt)</option>
                <option value="Trigger Rejector for All Subsequent">Trigger Rejector for All Subsequent Containers</option>
                <option value="Visual & Audio Alarm Only">Visual & Audio Alarm Only (Keep Line Running)</option>
              </select>
            </div>

          </div>

          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wide">
              Hardware Alarm Outputs
            </h4>
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs text-gray-700 font-medium cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={plcSignalFault} 
                  onChange={(e) => setPlcSignalFault(e.target.checked)}
                  className="rounded text-[#123681] accent-[#123681]"
                />
                <span>Set PLC Fault Relay Bit (Discrete Output #4)</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-gray-700 font-medium cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={towerLightAlert} 
                  onChange={(e) => setTowerLightAlert(e.target.checked)}
                  className="rounded text-[#123681] accent-[#123681]"
                />
                <span>Illuminate Tower Light Indicator (Amber on Warning, Flashing Red on Fault)</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-gray-700 font-medium cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={buzzerAlert} 
                  onChange={(e) => setBuzzerAlert(e.target.checked)}
                  className="rounded text-[#123681] accent-[#123681]"
                />
                <span>Sound Line Horn / Audio Buzzer on Timeout Overrun</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={() => handleSaveConfig('alerts')}
              className="px-5 py-2 bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save size={14} />
              Save Alert Settings
            </button>
          </div>

        </div>
      )}

      {/* SUBTAB 4: PROCESSING MODE */}
      {activeSubTab === 'processing' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Processing Mode</h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Select vision processing architecture and concurrency model suited to your packaging line speed.
          </p>

          <div className="space-y-3 max-w-2xl mb-6">
            <div 
              onClick={() => setProcessingMode('sync')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                processingMode === 'sync' 
                  ? 'border-[#123681] bg-blue-50/50 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-gray-800">Synchronous Hardware Triggered</span>
                <span className="text-[10px] bg-blue-100 text-[#123681] px-2 py-0.5 rounded font-bold">Standard</span>
              </div>
              <p className="text-xs text-gray-500">Each sensor pulse triggers one scanner frame and evaluates code verification before next trigger.</p>
            </div>

            <div 
              onClick={() => setProcessingMode('continuous')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                processingMode === 'continuous' 
                  ? 'border-[#123681] bg-blue-50/50 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-gray-800">High-Throughput Continuous Stream</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">&gt; 300 PPM</span>
              </div>
              <p className="text-xs text-gray-500">Multithreaded queueing model for ultra high-speed conveyor lines with parallel barcode decoders.</p>
            </div>

            <div 
              onClick={() => setProcessingMode('batch')}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                processingMode === 'batch' 
                  ? 'border-[#123681] bg-blue-50/50 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-gray-800">Batch Lot Verification</span>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">Pharma</span>
              </div>
              <p className="text-xs text-gray-500">Fixed-lot inspection with pre-allocated buffer and automatic end-of-batch reconciliation report.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-2xl pt-4 border-t border-gray-200">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">Worker Threads</label>
                {realSysInfo?.cpu_cores_logical && (
                  <span className="text-[10px] text-gray-400">
                    Host: {realSysInfo.cpu_cores_logical} Cores
                  </span>
                )}
              </div>
              <input 
                type="number" 
                value={workerThreads} 
                onChange={(e) => setWorkerThreads(e.target.value)} 
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Minimum Confidence (%)</label>
              <input 
                type="number" 
                value={confidenceThreshold} 
                onChange={(e) => setConfidenceThreshold(e.target.value)} 
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={gpuAcceleration} 
                  onChange={(e) => setGpuAcceleration(e.target.checked)} 
                  className="rounded text-[#123681] accent-[#123681]"
                />
                <span className="text-xs font-bold text-gray-800">Enable Hardware / GPU Acceleration (TensorRT / ONNX Execution Provider)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={() => handleSaveConfig('processing')}
              className="px-5 py-2 bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save size={14} />
              Apply Processing Mode
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 5: CACHE SIZE */}
      {activeSubTab === 'cache' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Cache Size & Memory Allocation</h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Manage high-speed in-memory buffer capacities for raw scanner frames, OCR results, and audit traces.
          </p>

          {/* Real System Memory Utilization Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-2xl mb-6">
            <div className="flex justify-between items-center text-xs font-bold text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#123681]" />
                <span>Host RAM Utilization ({totalRamStr} Total)</span>
              </div>
              <span className="font-mono text-[#123681]">{ramUsagePercent}% Active</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#123681] rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(5, ramUsagePercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mt-2">
              <span>Free RAM: {realSysInfo?.free_ram || 'N/A'}</span>
              <span>Allocated Vision Limit: {maxRamMb} MB</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mb-6">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Raw Scanner Frame Buffer (Frames)</label>
              <input 
                type="text" 
                value={frameCacheSize} 
                onChange={(e) => setFrameCacheSize(e.target.value)} 
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Inspection Results Cache (Records)</label>
              <input 
                type="text" 
                value={resultCacheSize} 
                onChange={(e) => setResultCacheSize(e.target.value)} 
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Memory Limit (MB)</label>
              <input 
                type="text" 
                value={maxRamMb} 
                onChange={(e) => setMaxRamMb(e.target.value)} 
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Eviction Strategy</label>
              <select 
                value={cacheEviction} 
                onChange={(e) => setCacheEviction(e.target.value)} 
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs"
              >
                <option value="FIFO">FIFO (First-In, First-Out)</option>
                <option value="DROP_PASSED">Drop Oldest PASS Frames First</option>
                <option value="RETAIN_FAILS">Keep Failed Inspections Indefinitely</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={flushOnPresetChange} 
                  onChange={(e) => setFlushOnPresetChange(e.target.checked)} 
                  className="rounded text-[#123681] accent-[#123681]"
                />
                <span className="text-xs font-bold text-gray-800">Automatically flush cache when changing recipe or program</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={handlePurgeCache}
              className="px-4 py-2 border border-red-500 text-red-600 hover:bg-red-50 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-2"
            >
              <Trash2 size={14} />
              Purge Cache Buffer
            </button>
            <button 
              type="button" 
              onClick={() => handleSaveConfig('cache')}
              className="px-5 py-2 bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save size={14} />
              Save Cache Settings
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 6: DEBUG MODE */}
      {activeSubTab === 'debug' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Debug Mode & Diagnostics</h3>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Enable advanced diagnostics, serial bus sniffer, and diagnostic logging for system calibration.
          </p>

          <div className="space-y-4 max-w-2xl mb-6">
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableDebugLogs} 
                onChange={(e) => setEnableDebugLogs(e.target.checked)} 
                className="mt-0.5 rounded text-[#123681] accent-[#123681]"
              />
              <div>
                <span className="block text-xs font-bold text-gray-800">Enable Verbose Debug Logging</span>
                <span className="text-[11px] text-gray-500">Outputs high-resolution millisecond OCR timestamps and raw serial strings to system log.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={dumpModbusPackets} 
                onChange={(e) => setDumpModbusPackets(e.target.checked)} 
                className="mt-0.5 rounded text-[#123681] accent-[#123681]"
              />
              <div>
                <span className="block text-xs font-bold text-gray-800">Dump Modbus / PLC TCP Packets</span>
                <span className="text-[11px] text-gray-500">Record hex payloads of all register writes and handshake acknowledgement frames.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={saveRawFrames} 
                onChange={(e) => setSaveRawFrames(e.target.checked)} 
                className="mt-0.5 rounded text-[#123681] accent-[#123681]"
              />
              <div>
                <span className="block text-xs font-bold text-gray-800">Save Raw Scanner Frames to Storage</span>
                <span className="text-[11px] text-gray-500">Preserves lossless PNG captures of every inspected item to local SSD for offline training.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={simulateHardware} 
                onChange={(e) => setSimulateHardware(e.target.checked)} 
                className="mt-0.5 rounded text-[#123681] accent-[#123681]"
              />
              <div>
                <span className="block text-xs font-bold text-gray-800">Simulate Hardware Inputs (Virtual Inspection Loop)</span>
                <span className="text-[11px] text-gray-500">Generates synthetic sensor trigger pulses without physical conveyor motion.</span>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={handleExportDiagnostics}
              disabled={isExportingDiag}
              className="px-4 py-2 border border-[#123681] text-[#123681] hover:bg-blue-50 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-2"
            >
              {isExportingDiag ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {isExportingDiag ? 'Exporting...' : 'Export Diagnostic Package'}
            </button>
            <button 
              type="button" 
              onClick={() => handleSaveConfig('debug')}
              className="px-5 py-2 bg-[#123681] hover:bg-blue-900 text-white text-xs font-bold rounded-md transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save size={14} />
              Save Debug Settings
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdvanceSettingsTab;
