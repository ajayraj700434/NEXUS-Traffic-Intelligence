import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Cpu,
  Clock,
  Download,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { ControllerType } from '../types';

interface TopHeaderProps {
  simulationTime: number;
  isRunning: boolean;
  speed: number;
  controllerType: ControllerType;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
  onToggleController: (type: ControllerType) => void;
  onExportCsv: () => void;
  hasStarvation?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  simulationTime,
  isRunning,
  speed,
  controllerType,
  onPlay,
  onPause,
  onStep,
  onReset,
  onChangeSpeed,
  onToggleController,
  onExportCsv,
  hasStarvation = false,
}) => {
  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <header className="header-bar">
      {/* Left: Clock and Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.85rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Clock size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            SIM CLOCK:
          </span>
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#f8fafc',
              minWidth: '68px',
            }}
          >
            {formatTime(simulationTime)}
          </span>
        </div>

        {/* Live Status indicator */}
        <div
          className={`badge ${
            isRunning ? 'badge-emerald' : 'badge-amber'
          }`}
        >
          <Activity size={12} className={isRunning ? 'animate-pulse-subtle' : ''} />
          <span>{isRunning ? `RUNNING (${speed}x)` : 'PAUSED'}</span>
        </div>

        {hasStarvation && (
          <div className="badge badge-rose">
            <AlertCircle size={12} />
            <span>STARVATION PREEMPTION ACTIVE</span>
          </div>
        )}
      </div>

      {/* Center: Controller Mode Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-canvas)',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={() => onToggleController('FIXED')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: controllerType === 'FIXED' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: controllerType === 'FIXED' ? '#fbbf24' : 'var(--text-muted)',
            boxShadow: controllerType === 'FIXED' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Cpu size={14} />
          Fixed-Time
        </button>

        <button
          onClick={() => onToggleController('ADAPTIVE')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: controllerType === 'ADAPTIVE' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: controllerType === 'ADAPTIVE' ? '#34d399' : 'var(--text-muted)',
            boxShadow: controllerType === 'ADAPTIVE' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Cpu size={14} />
          Adaptive AI
        </button>
      </div>

      {/* Right: Simulation Controls & Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Speed multiplier dropdown or buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            padding: '2px',
          }}
        >
          {[0.5, 1, 2, 4].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSpeed(spd)}
              style={{
                padding: '0.25rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: speed === spd ? 'var(--bg-surface-elevated)' : 'transparent',
                color: speed === spd ? '#38bdf8' : 'var(--text-muted)',
              }}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Play / Pause */}
        {isRunning ? (
          <button onClick={onPause} className="nexus-btn nexus-btn-secondary" title="Pause (Space)">
            <Pause size={14} />
            <span style={{ fontSize: '0.75rem' }}>Pause</span>
          </button>
        ) : (
          <button onClick={onPlay} className="nexus-btn nexus-btn-primary" title="Start / Resume">
            <Play size={14} fill="currentColor" />
            <span style={{ fontSize: '0.75rem' }}>Start</span>
          </button>
        )}

        {/* Single Step */}
        <button
          onClick={onStep}
          disabled={isRunning}
          className="nexus-btn nexus-btn-icon"
          title="Step forward 1 tick (0.5s)"
          style={{ opacity: isRunning ? 0.4 : 1, cursor: isRunning ? 'not-allowed' : 'pointer' }}
        >
          <StepForward size={14} />
        </button>

        {/* Reset */}
        <button onClick={onReset} className="nexus-btn nexus-btn-icon" title="Reset Simulation">
          <RotateCcw size={14} />
        </button>

        {/* Export CSV */}
        <button onClick={onExportCsv} className="nexus-btn nexus-btn-secondary" title="Export CSV Metrics">
          <Download size={14} />
          <span style={{ fontSize: '0.75rem' }}>Export</span>
        </button>
      </div>
    </header>
  );
};
