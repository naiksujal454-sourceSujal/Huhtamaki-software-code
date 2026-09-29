import { useState, useEffect } from 'react';
import Header from './components/Header/Header.tsx';
import type { InspectionState } from './components/Header/ControlsWidget.tsx';
import ScannerViewer from './components/ScannerViewer/ScannerViewer.tsx';
import ResultsPanel from './components/ResultsPanel/ResultsPanel.tsx';
import Footer from './components/Footer/Footer.tsx';
import EdgePanel from './components/Decorations/EdgePanel.tsx';
import AnalyticsView from './components/Dashboard/AnalyticsView.tsx';
import SettingsView from './components/Settings/SettingsView.tsx';
import LoginModal from './components/Login/LoginModal.tsx';
import SelectPresetModal from './components/Modals/SelectPresetModal.tsx';
import LogoutModal from './components/Modals/LogoutModal.tsx';
import CriticalAlarmModal from './components/Modals/CriticalAlarmModal.tsx';
import ConnectionsView from './components/Connections/ConnectionsView.tsx';
import { getCurrentUser, logoutUser } from './services/api';
import { auditLogger } from './services/auditLogger';
import { preloadRecipes } from './services/recipeStore';
import { preloadAllSettings } from './services/settingsStore';
import {
  type RecipeItem,
  type LiveCounters,
  type InspectionEvent,
  type AlarmDetails,
  startInspection,
  pauseInspection,
  resumeInspection,
  stopInspection,
  acknowledgeAlarm,
  getInspectionStatus,
  connectLiveInspectionWebSocket,
  injectDefect,
  setDefectConfig,
} from './services/inspectionService';
import { getApiUrl } from './services/apiConfig.ts';
import type { CreatedRecipe } from './services/recipeStore';

type ViewType = 'inspection' | 'analytics' | 'settings' | 'connections';

const DEFAULT_ACTIVE_RECIPE: RecipeItem = {
  id: 'recipe1',
  name: 'recipe1',
  type: 'Preset',
  targetCode: '8901030866784',
  image: getApiUrl('/api/recipes/image/recipe1.png'),
  rawImage: getApiUrl('/api/recipes/image/recipe1.png'),
  processedImage: getApiUrl('/api/recipes/processed/recipe1.png'),
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('inspection');
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Runtime Backend State
  const [inspectionState, setInspectionState] = useState<InspectionState>('IDLE');
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem>(DEFAULT_ACTIVE_RECIPE);
  const [counters, setCounters] = useState<LiveCounters>({
    total: 0,
    ok_count: 0,
    nok_count: 0,
    pass_rate: 100.0,
    current_ppm: 0,
  });
  const [lastEvent, setLastEvent] = useState<InspectionEvent | null>(null);
  const [alarmDetails, setAlarmDetails] = useState<AlarmDetails | null>(null);
  const [recentEvents, setRecentEvents] = useState<InspectionEvent[]>([]);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('General Settings');

  // Check active session on startup
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user && user.is_active) {
          setCurrentUser({ username: user.username, role: user.role.toUpperCase() });
          setIsAuthenticated(true);
          auditLogger.setCurrentUser(user.username);
        }
      })
      .catch((err) => {
        console.warn('No active session found:', err);
      });

    // Sync initial runtime state with backend
    getInspectionStatus()
      .then((status) => {
        if (status) {
          setInspectionState(status.state as InspectionState);
          if (status.counters) setCounters(status.counters);
          if (status.active_recipe) setActiveRecipe(status.active_recipe);
          if (status.alarm_details) setAlarmDetails(status.alarm_details);
          if (status.recent_events && status.recent_events.length > 0) {
            setLastEvent(status.recent_events[0]);
            setRecentEvents(status.recent_events);
          }
        }
      })
      .catch((err) => {
        console.warn('Backend inspection status check:', err);
      });

    // Eagerly preload all recipes and warm images into RAM cache for instant 0ms access
    preloadRecipes();
    preloadAllSettings();

    // Preload demo container images in browser RAM cache for instantaneous 60FPS streaming
    fetch(getApiUrl('/api/recipes/demo-image-list'))
      .then((res) => res.json())
      .then((fileList: string[]) => {
        if (Array.isArray(fileList)) {
          fileList.forEach((filename) => {
            const rawImg = new Image();
            rawImg.src = getApiUrl(`/api/recipes/image/${filename}`);
            const procImg = new Image();
            procImg.src = getApiUrl(`/api/recipes/processed/${filename}`);
          });
        }
      })
      .catch((e) => console.debug('Demo image preloader:', e));

    // Connect to live WebSocket stream
    const disconnectWs = connectLiveInspectionWebSocket(
      (event, liveCounters, backendRecent) => {
        setLastEvent(event);
        if (liveCounters) setCounters(liveCounters);
        if (backendRecent && backendRecent.length > 0) {
          setRecentEvents(backendRecent);
        } else {
          setRecentEvents((prev) => [event, ...prev.slice(0, 29)]);
        }
      },
      (alarm, liveCounters, backendRecent) => {
        setAlarmDetails(alarm);
        setInspectionState('PAUSED');
        if (liveCounters) setCounters(liveCounters);
        if (backendRecent && backendRecent.length > 0) {
          setRecentEvents(backendRecent);
          // Instantly sync camera viewer and results panel to defect bottle
          setLastEvent(backendRecent[0]);
        } else if (alarm) {
          setLastEvent({
            id: alarm.defect_id,
            status: 'NOK',
            recipe_name: activeRecipe.name || 'Unknown',
            scanned_code: alarm.scanned_code || '',
            expected_code: alarm.expected_code || '',
            reason: alarm.reason || 'DEFECT_DETECTED',
            confidence: 98.5,
            inspected_at: alarm.timestamp || '',
            latency_ms: 95.8,
            image_url: alarm.image_url || '',
            processed_image_url: alarm.processed_image_url,
            raw_image_url: alarm.raw_image_url,
          });
        }
      },
      (state, liveCounters, recipe, backendRecent) => {
        setInspectionState(state as InspectionState);
        if (liveCounters) setCounters(liveCounters);
        if (recipe) setActiveRecipe(recipe);
        if (backendRecent && backendRecent.length > 0) {
          setRecentEvents(backendRecent);
        }
      }
    );

    return () => {
      disconnectWs();
    };
  }, []);

  const handleLogin = (user: { username: string; role: string }) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    auditLogger.setCurrentUser(user.username);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Logout API call failed:', err);
    }
    setIsLogoutModalOpen(false);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView('inspection');
    auditLogger.setCurrentUser(null);
  };

  const [simulateDefects, setSimulateDefects] = useState(true);
  const [stopOnDefect, setStopOnDefect] = useState(true);

  // Runtime Control Handlers wired directly to Backend
  const handleToggleDefects = async (enabled: boolean) => {
    setSimulateDefects(enabled);
    try {
      await setDefectConfig(enabled, stopOnDefect);
      auditLogger.logAction('Inspection', 'config.defect_simulation', `Defect simulation set to ${enabled}`);
    } catch (err) {
      console.warn('Failed to update defect config:', err);
    }
  };

  const handleToggleStopOnDefect = async (stop: boolean) => {
    setStopOnDefect(stop);
    try {
      await setDefectConfig(simulateDefects, stop);
      auditLogger.logAction('Inspection', 'config.stop_on_defect', `Stop on defect set to ${stop}`);
    } catch (err) {
      console.warn('Failed to update stop on defect:', err);
    }
  };

  const handleInjectDefect = async () => {
    try {
      await injectDefect();
      auditLogger.logAction('Inspection', 'inspection.defect_injected', 'Operator injected manual defect for testing');
    } catch (err) {
      console.warn('Failed to inject defect:', err);
    }
  };

  const handleStart = async () => {
    try {
      const res = await startInspection(activeRecipe.id, activeRecipe, 'simulation', simulateDefects, stopOnDefect);
      if (res && res.status) {
        setInspectionState(res.status.state as InspectionState);
        if (res.status.counters) setCounters(res.status.counters);
      }
      auditLogger.logAction('Inspection', 'inspection.started', `Started inspection for ${activeRecipe.name}`, {
        recipe: activeRecipe.name,
        targetCode: activeRecipe.targetCode,
        simulateDefects,
        stopOnDefect,
      });
    } catch (err) {
      console.error('Failed to start inspection:', err);
    }
  };

  const handlePause = async () => {
    try {
      const res = await pauseInspection();
      if (res && res.status) {
        setInspectionState(res.status.state as InspectionState);
      }
      auditLogger.logAction('Inspection', 'inspection.paused', 'Paused inspection');
    } catch (err) {
      console.error('Failed to pause inspection:', err);
    }
  };

  const handleResume = async () => {
    try {
      const res = await resumeInspection();
      if (res && res.status) {
        setInspectionState(res.status.state as InspectionState);
        setAlarmDetails(null);
      }
      auditLogger.logAction('Inspection', 'inspection.resumed', 'Resumed inspection');
    } catch (err) {
      console.error('Failed to resume inspection:', err);
    }
  };

  const handleStop = async () => {
    try {
      const res = await stopInspection();
      if (res && res.status) {
        setInspectionState(res.status.state as InspectionState);
        if (res.status.counters) setCounters(res.status.counters);
      }
      auditLogger.logAction('Inspection', 'inspection.stopped', 'Stopped inspection batch');
    } catch (err) {
      console.error('Failed to stop inspection:', err);
    }
  };

  const handleAcknowledgeAlarm = async () => {
    try {
      await acknowledgeAlarm();
      auditLogger.logAction('Alarm', 'alarm.silenced', 'Buzzer silenced by operator');
    } catch (err) {
      console.error('Failed to acknowledge alarm:', err);
    }
  };

  const handleResumeFromAlarm = async () => {
    try {
      // Immediately dismiss modal on accept
      setAlarmDetails(null);
      await acknowledgeAlarm();
      const res = await resumeInspection();
      if (res && res.status) {
        setInspectionState(res.status.state as InspectionState);
      }
      auditLogger.logAction('Alarm', 'alarm.cleared_and_resumed', 'Defect accepted and production line resumed');
    } catch (err) {
      console.error('Failed to resume from alarm:', err);
    }
  };

  const handleNavigate = (view: ViewType) => {
    if (view !== currentView) {
      auditLogger.logNavigation(view);
      setCurrentView(view);
    }
  };

  const isLeftDisabled = currentView === 'analytics' || currentView === 'settings';
  const isRightDisabled = currentView === 'connections';

  const handleLeftArrowClick = () => {
    if (isLeftDisabled) return;
    auditLogger.logNavigation('analytics', 'Navigated to Settings & Detailed Dashboard (via left button)');
    setCurrentView('analytics');
  };

  const handleRightArrowClick = () => {
    if (isRightDisabled) return;
    auditLogger.logNavigation('connections', 'Navigated to Hardware, Scanner & PLC Configs (via right button)');
    setCurrentView('connections');
  };

  const isRunning = inspectionState === 'RUNNING';
  const lastStatusText: 'OK' | 'NOT OK' | 'IDLE' | 'PAUSED' =
    alarmDetails !== null || (lastEvent && lastEvent.status === 'NOK')
      ? 'NOT OK'
      : inspectionState === 'RUNNING'
      ? (lastEvent ? (lastEvent.status === 'OK' ? 'OK' : 'NOT OK') : 'OK')
      : inspectionState === 'PAUSED'
      ? 'PAUSED'
      : 'IDLE';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-gray-800 font-ubuntu relative bg-pixtron-blue">
      {/* Login Overlay */}
      {!isAuthenticated && (
        <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
          <LoginModal onLogin={handleLogin} />
        </div>
      )}

      {/* Critical Alarm Defect Box (Compact Floating Alert Card) */}
      {alarmDetails && (
        <CriticalAlarmModal
          alarm={alarmDetails}
          onAcknowledge={handleAcknowledgeAlarm}
          onResume={handleResumeFromAlarm}
          onOpenAlertConfig={() => {
            setSettingsInitialTab('Alert Configuration');
            handleNavigate('settings');
          }}
        />
      )}

      {/* Navigation Arrows: Left is strictly for Settings & Dashboard; Right is strictly for Hardware/Scanner/PLC */}
      <EdgePanel direction="left" onClick={handleLeftArrowClick} disabled={isLeftDisabled} />
      <EdgePanel direction="right" onClick={handleRightArrowClick} disabled={isRightDisabled} />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col h-full w-full px-12 pt-2 pb-0 z-10 overflow-hidden min-h-0">
        <Header
          state={inspectionState}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          passCount={counters.ok_count}
          failCount={counters.nok_count}
          totalCount={counters.total}
          passRate={counters.pass_rate}
          inspectionTimeMs={lastEvent ? lastEvent.latency_ms : '0'}
          speedPpm={counters.current_ppm}
          lastStatus={lastStatusText}
          alertCount={counters.nok_count}
          hasActiveAlarm={alarmDetails !== null}
        />

        <div className="flex-1 flex overflow-hidden mt-2 mb-2 min-h-0">
          {currentView === 'inspection' && (
            <div className="flex w-full h-full gap-2 relative min-h-0">
              <div className="flex-1 h-full overflow-hidden min-h-0">
                <ScannerViewer
                  isRunning={isRunning || inspectionState === 'PAUSED'}
                  rawImageUrl={lastEvent?.raw_image_url || activeRecipe.rawImage || activeRecipe.image}
                  processedImageUrl={lastEvent?.processed_image_url || activeRecipe.processedImage || getApiUrl(`/api/recipes/processed/${activeRecipe.name}.png`)}
                  activeImageUrl={lastEvent?.image_url || activeRecipe.processedImage || activeRecipe.image}
                  activeRecipeName={activeRecipe.name}
                  lastStatus={lastEvent?.status || 'IDLE'}
                  scannedCode={lastEvent?.scanned_code}
                  expectedCode={activeRecipe.targetCode}
                  scanSequence={lastEvent?.id || counters.total}
                  latencyMs={lastEvent?.latency_ms || '0'}
                  simulateDefects={simulateDefects}
                  onToggleDefects={handleToggleDefects}
                  stopOnDefect={stopOnDefect}
                  onToggleStopOnDefect={handleToggleStopOnDefect}
                  onInjectDefect={handleInjectDefect}
                  onOpenPreset={() => {
                    auditLogger.logAction('Preset', 'preset.open_dialog', 'Opened preset selection dialog');
                    setIsPresetModalOpen(true);
                  }}
                />
              </div>
              <div className="flex-1 h-full overflow-hidden min-h-0">
                <ResultsPanel
                  isRunning={isRunning || inspectionState === 'PAUSED'}
                  lastEvent={lastEvent}
                  activeRecipeName={activeRecipe.name}
                  expectedCode={activeRecipe.targetCode}
                  recentEvents={recentEvents}
                />
              </div>
            </div>
          )}

          {currentView === 'analytics' && (
            <AnalyticsView onNavigate={handleNavigate} />
          )}

          {currentView === 'settings' && (
            <SettingsView onNavigate={handleNavigate} initialTab={settingsInitialTab} currentUser={currentUser} />
          )}

          {currentView === 'connections' && (
            <ConnectionsView
              onNavigate={handleNavigate}
              onOpenPreset={() => {
                auditLogger.logAction('Preset', 'preset.open_dialog', 'Opened preset selection dialog');
                setIsPresetModalOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <Footer
        onHomeClick={() => {
          auditLogger.logNavigation('inspection', 'Clicked Home button - returned to Home view');
          setCurrentView('inspection');
        }}
        isAuthenticated={isAuthenticated}
        user={currentUser}
        onLogoutClick={() => {
          auditLogger.logAction('Logout', 'auth.logout_prompt', 'Opened logout confirmation dialog');
          setIsLogoutModalOpen(true);
        }}
      />

      {isLogoutModalOpen && (
        <LogoutModal
          user={currentUser}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirmLogout={handleLogout}
        />
      )}

      {isPresetModalOpen && (
        <SelectPresetModal
          activeRecipeId={activeRecipe.id}
          onClose={() => setIsPresetModalOpen(false)}
          onSelect={(preset: CreatedRecipe) => {
            const updated: RecipeItem = {
              id: preset.id,
              name: preset.name,
              type: preset.type || 'Preset',
              targetCode: preset.targetCode || '',
              image: preset.image,
              rawImage: preset.rawImage || preset.image,
              processedImage: preset.processedImage || getApiUrl(`/api/recipes/processed/${preset.name}.png`),
            };
            setActiveRecipe(updated);
            auditLogger.logAction('Preset', 'preset.loaded', `Loaded recipe preset: ${preset.name}`, { preset: preset.name });
            setIsPresetModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
