import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Sliders,
  Sparkles,
  Car,
  AlertTriangle,
  Tag,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  Approach,
  ControllerDecision,
  ControllerType,
  PhaseType,
  SignalStatus,
  SimulationConfig,
  SimulationMetrics,
  Vehicle,
} from '../types';
import { IntersectionSimulator } from '../components/IntersectionSimulator';
import { SCENARIO_PRESETS } from '../simulation/scenarios';

interface LiveSimulationPageProps {
  metrics: SimulationMetrics;
  vehicles: Record<Approach, Vehicle[]>;
  signals: Record<Approach, SignalStatus>;
  currentPhase: PhaseType;
  currentPhaseDuration: number;
  phaseElapsedTime: number;
  controllerType: ControllerType;
  config: SimulationConfig;
  lastDecision: ControllerDecision | null;
  isRunning: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onChangeSpeed: (spd: number) => void;
  onToggleController: (type: ControllerType) => void;
  onUpdateConfig: (partial: Partial<SimulationConfig>) => void;
  onSpawnEmergency?: (approach: Approach) => void;
}

export const LiveSimulationPage: React.FC<LiveSimulationPageProps> = ({
  metrics,
  vehicles,
  signals,
  currentPhase,
  currentPhaseDuration,
  phaseElapsedTime,
  controllerType,
  config,
  lastDecision,
  isRunning,
  speed,
  onPlay,
  onPause,
  onStep,
  onReset,
  onChangeSpeed,
  onToggleController,
  onUpdateConfig,
}) => {
  const [showLabels, setShowLabels] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const phasePrefix = currentPhase.split('_')[0];
  const isYellow = currentPhase.endsWith('_YELLOW');
  const isAllRed = currentPhase === 'ALL_RED';
  const axisLabel = isAllRed
    ? 'ALL-RED CLEARANCE'
    : phasePrefix === 'NS'
    ? `NORTH-SOUTH AXIS (${isYellow ? 'YELLOW' : 'GREEN'})`
    : phasePrefix === 'EW'
    ? `EAST-WEST AXIS (${isYellow ? 'YELLOW' : 'GREEN'})`
    : `${phasePrefix} APPROACH (${isYellow ? 'YELLOW' : 'GREEN'})`;

  const timeRemaining = Math.max(
    0,
    Math.round(
      (isAllRed
        ? config.allRedDuration
        : isYellow
        ? config.yellowDuration
        : currentPhaseDuration) - phaseElapsedTime
    )
  );

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title & Control Action Bar */}
      <div
        className="nexus-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              Live 4-Way Intersection Simulator
            </h1>
            <span className={`badge ${controllerType === 'ADAPTIVE' ? 'badge-emerald' : 'badge-amber'}`}>
              {controllerType === 'ADAPTIVE' ? 'Adaptive Policy' : 'Fixed Timing'}
            </span>
            <span className="badge badge-cyan">
              Phase: {currentPhase}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Real-time physics and phase state machine with conflict-free safety interlocking.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isRunning ? (
            <button onClick={onPause} className="nexus-btn nexus-btn-secondary">
              <Pause size={16} /> Pause
            </button>
          ) : (
            <button onClick={onPlay} className="nexus-btn nexus-btn-primary">
              <Play size={16} fill="currentColor" /> Resume
            </button>
          )}

          <button
            onClick={onStep}
            disabled={isRunning}
            className="nexus-btn nexus-btn-icon"
            title="Single Step (0.5s tick)"
            style={{ opacity: isRunning ? 0.4 : 1 }}
          >
            <StepForward size={16} />
          </button>

          <button onClick={onReset} className="nexus-btn nexus-btn-icon" title="Reset Simulation">
            <RotateCcw size={16} />
          </button>

          {/* Speed Buttons */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: speed === s ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: speed === s ? '#38bdf8' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Toggle Labels */}
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`nexus-btn ${showLabels ? 'nexus-btn-cyan' : 'nexus-btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem' }}
          >
            <Tag size={14} />
            {showLabels ? 'Hide Labels' : 'Show Labels'}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Simulator / Right Controls & Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.25fr) minmax(320px, 0.75fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Centerpiece SVG Simulator */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Signal Status Pill Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isAllRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981',
                  boxShadow: `0 0 10px ${isAllRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981'}`,
                }}
              />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT RIGHT-OF-WAY: </span>
                <span style={{ fontWeight: 800, color: '#ffffff' }}>
                  {axisLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TIME REMAINING:</span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: isYellow ? '#fbbf24' : '#34d399',
                }}
              >
                {timeRemaining}s
              </span>
            </div>
          </div>

          {/* Canvas SVG Simulator */}
          <IntersectionSimulator
            vehicles={vehicles}
            signals={signals}
            currentPhase={currentPhase}
            showLabels={showLabels}
            selectedVehicleId={selectedVehicle?.id || null}
            onSelectVehicle={setSelectedVehicle}
          />

          {/* Rationale Bar underneath simulator */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>Agent Rationale: </span>
            {lastDecision?.rationale || 'Calculating queue dynamics...'}
          </div>
        </div>

        {/* Right Column: Scenario selector, approach sliders, and vehicle inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Scenario Preset Dropdown */}
          <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#38bdf8" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Reproducible Scenario Presets
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onUpdateConfig({
                      ...preset.config,
                    });
                    onReset();
                  }}
                  style={{
                    padding: '0.65rem',
                    textAlign: 'left',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
                    {preset.name}
                  </p>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: '#38bdf8',
                      fontWeight: 600,
                    }}
                  >
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Approach Arrival Intensity Sliders */}
          <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={16} color="#34d399" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                  Traffic Arrival Intensity
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vehicles / min</span>
            </div>

            {(['N', 'S', 'E', 'W'] as Approach[]).map((app) => (
              <div key={app} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {app} Approach ({app === 'N' ? 'North' : app === 'S' ? 'South' : app === 'E' ? 'East' : 'West'})
                  </span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: '#38bdf8' }}>
                    {config.arrivalRates[app]} veh/min
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="45"
                  step="1"
                  value={config.arrivalRates[app]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateConfig({
                      arrivalRates: {
                        ...config.arrivalRates,
                        [app]: val,
                      },
                    });
                  }}
                  style={{ width: '100%', accentColor: '#06b6d4' }}
                />
              </div>
            ))}
          </div>

          {/* Selected Vehicle Inspector */}
          {selectedVehicle ? (
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #38bdf8' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Car size={16} color="#38bdf8" />
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                    Vehicle #{selectedVehicle.id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedVehicle(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  ✕ Close
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Type: </span>
                  <span style={{ fontWeight: 600, color: '#ffffff', textTransform: 'capitalize' }}>{selectedVehicle.type}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Approach: </span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedVehicle.approach}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>State: </span>
                  <span style={{ fontWeight: 600, color: selectedVehicle.state === 'queued' ? '#fbbf24' : '#34d399', textTransform: 'capitalize' }}>
                    {selectedVehicle.state}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Wait Time: </span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: '#f8fafc' }}>
                    {selectedVehicle.waitingTime.toFixed(1)}s
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Arrival Time: </span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: '#f8fafc' }}>
                    {selectedVehicle.arrivalTime.toFixed(1)}s
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Emergency: </span>
                  <span style={{ fontWeight: 700, color: selectedVehicle.isEmergency ? '#ef4444' : '#94a3b8' }}>
                    {selectedVehicle.isEmergency ? 'YES (Priority)' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="nexus-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
              }}
            >
              <Car size={18} />
              <span>Click any vehicle on the simulator canvas to inspect telemetry (speed, wait duration, state).</span>
            </div>
          )}

          {/* Safety Verification Badge */}
          <div
            className="nexus-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <ShieldCheck size={20} color="#34d399" />
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>
                Phase Safety Guarantee Active
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Conflicting orthogonal greens locked out. 100% compliant with MUTCD clearance rules.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
