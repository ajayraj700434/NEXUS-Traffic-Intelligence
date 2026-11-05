import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Approach, ControllerType, SimulationConfig, SimulationMetrics } from './types';
import { SimulationEngine } from './simulation/SimulationEngine';
import { DEFAULT_CONFIG } from './simulation/scenarios';
import { NavigationSidebar, NavTab } from './components/NavigationSidebar';
import { TopHeader } from './components/TopHeader';
import { OverviewPage } from './pages/OverviewPage';
import { LiveSimulationPage } from './pages/LiveSimulationPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ComparisonLabPage } from './pages/ComparisonLabPage';
import { DecisionLogsPage } from './pages/DecisionLogsPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { AboutProjectPage } from './pages/AboutProjectPage';
import { CsvExporter } from './analytics/csvExport';

export const App: React.FC = () => {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Configuration State
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);

  // Authoritative Central Simulation Engine Reference
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(DEFAULT_CONFIG);
  }

  // Reactive UI State synchronized with the engine
  const [metrics, setMetrics] = useState<SimulationMetrics>(() => engineRef.current!.getMetrics());
  const [signals, setSignals] = useState(() => engineRef.current!.getSignalStatuses());
  const [vehicles, setVehicles] = useState(() => engineRef.current!.getVehicles());
  const [currentPhase, setCurrentPhase] = useState(() => engineRef.current!.getCurrentPhase());
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(() => engineRef.current!.getCurrentPhaseDuration());
  const [phaseElapsedTime, setPhaseElapsedTime] = useState(() => engineRef.current!.getPhaseElapsedTime());
  const [simulationTime, setSimulationTime] = useState(() => engineRef.current!.getCurrentTime());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [controllerType, setControllerType] = useState<ControllerType>('ADAPTIVE');
  const [lastDecision, setLastDecision] = useState(() => engineRef.current!.getLastDecision());
  const [events, setEvents] = useState(() => engineRef.current!.getEvents());

  // Analytics History Buffer (sampled every 1 simulated second)
  const [history, setHistory] = useState<
    Array<{
      time: number;
      queueN: number;
      queueS: number;
      queueE: number;
      queueW: number;
      totalQueued: number;
      avgWait: number;
      throughput: number;
      served: number;
    }>
  >([]);

  const lastSampleTimeRef = useRef<number>(0);

  // Synchronize React state with engine
  const syncState = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const m = engine.getMetrics();
    const curTime = engine.getCurrentTime();
    setMetrics(m);
    setSignals(engine.getSignalStatuses());
    setVehicles({ ...engine.getVehicles() });
    setCurrentPhase(engine.getCurrentPhase());
    setCurrentPhaseDuration(engine.getCurrentPhaseDuration());
    setPhaseElapsedTime(engine.getPhaseElapsedTime());
    setSimulationTime(curTime);
    setIsRunning(engine.getIsRunning());
    setLastDecision(engine.getLastDecision());
    setEvents([...engine.getEvents()]);

    // Sample history point every ~1s of simulation time
    if (curTime - lastSampleTimeRef.current >= 1.0) {
      lastSampleTimeRef.current = curTime;
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: Math.round(curTime),
            queueN: m.approachQueues.N,
            queueS: m.approachQueues.S,
            queueE: m.approachQueues.E,
            queueW: m.approachQueues.W,
            totalQueued: m.currentQueued,
            avgWait: m.avgWaitingTime,
            throughput: m.throughputPerMin,
            served: m.totalServed,
          },
        ];
        return next.length > 300 ? next.slice(next.length - 300) : next;
      });
    }
  }, []);

  // Main Animation & Simulation Ticking Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastWallClock = performance.now();

    const loop = (now: number) => {
      const dtReal = (now - lastWallClock) / 1000;
      lastWallClock = now;

      const engine = engineRef.current;
      if (engine && engine.getIsRunning()) {
        // Step simulation proportional to real time and speed multiplier
        const dtSim = Math.min(0.2, dtReal * engine.getSpeed());
        engine.step(dtSim);
        syncState();
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [syncState]);

  // Simulation Controls
  const handlePlay = () => {
    engineRef.current?.play();
    setIsRunning(true);
  };

  const handlePause = () => {
    engineRef.current?.pause();
    setIsRunning(false);
  };

  const handleStep = () => {
    if (engineRef.current && !engineRef.current.getIsRunning()) {
      engineRef.current.step(0.5);
      syncState();
    }
  };

  const handleReset = (newSeed?: number) => {
    engineRef.current?.reset(newSeed);
    lastSampleTimeRef.current = 0;
    setHistory([]);
    syncState();
  };

  const handleChangeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    engineRef.current?.setSpeed(newSpeed);
  };

  const handleToggleController = (type: ControllerType) => {
    setControllerType(type);
    engineRef.current?.setControllerType(type);
    syncState();
  };

  const handleUpdateConfig = (partial: Partial<SimulationConfig>) => {
    const updated = { ...config, ...partial };
    setConfig(updated);
    engineRef.current?.updateConfig(updated);
    if (partial.controllerType) {
      setControllerType(partial.controllerType);
    }
    syncState();
  };

  const handleClearLogs = () => {
    handleReset();
  };

  const handleExportCsv = () => {
    CsvExporter.exportMetricsToCsv(metrics);
  };

  // Keyboard Shortcuts: Space (Play/Pause), S (Step), R (Reset), 1-7 (Nav)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (engineRef.current?.getIsRunning()) {
          handlePause();
        } else {
          handlePlay();
        }
      } else if (e.key === 's' || e.key === 'S') {
        handleStep();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === '1') {
        setCurrentTab('overview');
      } else if (e.key === '2') {
        setCurrentTab('simulation');
      } else if (e.key === '3') {
        setCurrentTab('analytics');
      } else if (e.key === '4') {
        setCurrentTab('comparison');
      } else if (e.key === '5') {
        setCurrentTab('logs');
      } else if (e.key === '6') {
        setCurrentTab('scenarios');
      } else if (e.key === '7') {
        setCurrentTab('about');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container">
      {/* Collapsible Left Navigation Sidebar */}
      <NavigationSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        controllerMode={controllerType}
      />

      {/* Main Workspace Area */}
      <div className="main-content">
        {/* Top Header Bar */}
        <TopHeader
          simulationTime={simulationTime}
          isRunning={isRunning}
          speed={speed}
          controllerType={controllerType}
          onPlay={handlePlay}
          onPause={handlePause}
          onStep={handleStep}
          onReset={() => handleReset()}
          onChangeSpeed={handleChangeSpeed}
          onToggleController={handleToggleController}
          onExportCsv={handleExportCsv}
          hasStarvation={lastDecision?.starvationOverride || false}
        />

        {/* Dynamic View Router */}
        <main style={{ flex: 1 }}>
          {currentTab === 'overview' && (
            <OverviewPage
              metrics={metrics}
              vehicles={vehicles}
              signals={signals}
              currentPhase={currentPhase}
              controllerType={controllerType}
              lastDecision={lastDecision}
              isRunning={isRunning}
              onStartSim={handlePlay}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'simulation' && (
            <LiveSimulationPage
              metrics={metrics}
              vehicles={vehicles}
              signals={signals}
              currentPhase={currentPhase}
              currentPhaseDuration={currentPhaseDuration}
              phaseElapsedTime={phaseElapsedTime}
              controllerType={controllerType}
              config={config}
              lastDecision={lastDecision}
              isRunning={isRunning}
              speed={speed}
              onPlay={handlePlay}
              onPause={handlePause}
              onStep={handleStep}
              onReset={() => handleReset()}
              onChangeSpeed={handleChangeSpeed}
              onToggleController={handleToggleController}
              onUpdateConfig={handleUpdateConfig}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage metrics={metrics} history={history} />
          )}

          {currentTab === 'comparison' && (
            <ComparisonLabPage currentConfig={config} />
          )}

          {currentTab === 'logs' && (
            <DecisionLogsPage events={events} onClearLogs={handleClearLogs} />
          )}

          {currentTab === 'scenarios' && (
            <ScenariosPage
              config={config}
              onUpdateConfig={handleUpdateConfig}
              onResetSimulation={() => handleReset()}
            />
          )}

          {currentTab === 'about' && <AboutProjectPage />}
        </main>
      </div>
    </div>
  );
};

export default App;
