import React, { useState } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Cpu,
  Layers,
  Clock,
  Shield,
} from 'lucide-react';
import { Approach, ScenarioPreset, SimulationConfig } from '../types';
import { DEFAULT_CONFIG, SCENARIO_PRESETS } from '../simulation/scenarios';

interface ScenariosPageProps {
  config: SimulationConfig;
  onUpdateConfig: (newConfig: Partial<SimulationConfig>) => void;
  onResetSimulation: () => void;
}

export const ScenariosPage: React.FC<ScenariosPageProps> = ({
  config,
  onUpdateConfig,
  onResetSimulation,
}) => {
  const [activePresetId, setActivePresetId] = useState<string>('balanced-city');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyPreset = (preset: ScenarioPreset) => {
    setActivePresetId(preset.id);
    onUpdateConfig(preset.config);
    onResetSimulation();
    showSuccess(`Applied preset: ${preset.name}`);
  };

  const handleResetDefaults = () => {
    onUpdateConfig(DEFAULT_CONFIG);
    onResetSimulation();
    showSuccess('Reset all parameters to default configuration');
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleNumberChange = (key: keyof SimulationConfig, val: number, min: number, max: number) => {
    if (isNaN(val)) return;
    if (val < min || val > max) {
      setErrorMsg(`${key} must be between ${min} and ${max}`);
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    // Min green cannot exceed max green
    if (key === 'adaptiveMinGreen' && val > config.adaptiveMaxGreen) {
      setErrorMsg('Min Green cannot exceed Max Green');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    if (key === 'adaptiveMaxGreen' && val < config.adaptiveMinGreen) {
      setErrorMsg('Max Green cannot be less than Min Green');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    onUpdateConfig({ [key]: val });
    showSuccess(`Updated ${key} to ${val}`);
  };

  const handleArrivalRateChange = (app: Approach, val: number) => {
    if (isNaN(val) || val < 0 || val > 60) return;
    onUpdateConfig({
      arrivalRates: {
        ...config.arrivalRates,
        [app]: val,
      },
    });
  };

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title Bar */}
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
            <SlidersHorizontal size={20} color="#38bdf8" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              Scenario Presets & Simulation Workspace
            </h1>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Configure synthetic traffic generation parameters, adaptive decision policy weights, and signal timing intervals.
          </p>
        </div>

        <button onClick={handleResetDefaults} className="nexus-btn nexus-btn-secondary">
          <RotateCcw size={16} />
          Reset All to Defaults
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="badge badge-emerald" style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="badge badge-rose" style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Scenario Presets Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
          Standard Reproducible Scenarios
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {SCENARIO_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;

            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className="nexus-card"
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                    {preset.name}
                  </h3>
                  <span className="badge badge-cyan">{preset.badge}</span>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', flex: 1 }}>
                  {preset.description}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Seed: {preset.config.seed || 42}
                  </span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {isSelected ? '✓ Active Preset' : 'Click to Load'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Signal Timing Limits */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="#fbbf24" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
              Signal Timing Intervals (MUTCD)
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fixed Green Duration (s)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.fixedGreenDuration}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                value={config.fixedGreenDuration}
                onChange={(e) => handleNumberChange('fixedGreenDuration', parseInt(e.target.value, 10), 10, 60)}
                style={{ width: '100%', accentColor: '#fbbf24' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Adaptive Min Green (s)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.adaptiveMinGreen}s</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                value={config.adaptiveMinGreen}
                onChange={(e) => handleNumberChange('adaptiveMinGreen', parseInt(e.target.value, 10), 5, 25)}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Adaptive Max Green (s)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.adaptiveMaxGreen}s</span>
              </div>
              <input
                type="range"
                min="30"
                max="90"
                value={config.adaptiveMaxGreen}
                onChange={(e) => handleNumberChange('adaptiveMaxGreen', parseInt(e.target.value, 10), 30, 90)}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Yellow Clearance Interval (s)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.yellowDuration}s</span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                value={config.yellowDuration}
                onChange={(e) => handleNumberChange('yellowDuration', parseInt(e.target.value, 10), 2, 6)}
                style={{ width: '100%', accentColor: '#f59e0b' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>All-Red Clearance Interval (s)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.allRedDuration}s</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={config.allRedDuration}
                onChange={(e) => handleNumberChange('allRedDuration', parseInt(e.target.value, 10), 1, 4)}
                style={{ width: '100%', accentColor: '#ef4444' }}
              />
            </div>
          </div>
        </div>

        {/* Adaptive Policy Weights */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={16} color="#34d399" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
              Adaptive Decision Policy Weights
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Queue Length Weight (W_q)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.queueWeight}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={config.queueWeight}
                onChange={(e) => handleNumberChange('queueWeight', parseFloat(e.target.value), 0.1, 5.0)}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Waiting Time Weight (W_w)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.waitWeight}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={config.waitWeight}
                onChange={(e) => handleNumberChange('waitWeight', parseFloat(e.target.value), 0.1, 5.0)}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Arrival Rate Weight (W_a)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.arrivalRateWeight}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={config.arrivalRateWeight}
                onChange={(e) => handleNumberChange('arrivalRateWeight', parseFloat(e.target.value), 0.1, 3.0)}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Starvation Threshold (s)</span>
                <span className="tabular-nums" style={{ color: '#ffffff', fontWeight: 700 }}>{config.starvationThreshold}s</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                step="5"
                value={config.starvationThreshold}
                onChange={(e) => handleNumberChange('starvationThreshold', parseInt(e.target.value, 10), 20, 120)}
                style={{ width: '100%', accentColor: '#ef4444' }}
              />
            </div>
          </div>
        </div>

        {/* PRNG & Simulation Horizon */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} color="#a78bfa" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
              Execution Horizon & Determinism
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Seeded PRNG Random Seed
              </label>
              <input
                type="number"
                min="1"
                max="99999"
                value={config.seed}
                onChange={(e) => handleNumberChange('seed', parseInt(e.target.value, 10), 1, 99999)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: 'var(--bg-canvas)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                }}
              />
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Identical seeds produce bit-exact identical vehicle arrivals across runs.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Simulation Duration Horizon: {config.simulationDuration}s
              </label>
              <input
                type="range"
                min="60"
                max="600"
                step="30"
                value={config.simulationDuration}
                onChange={(e) => handleNumberChange('simulationDuration', parseInt(e.target.value, 10), 60, 600)}
                style={{ width: '100%', accentColor: '#a78bfa' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
