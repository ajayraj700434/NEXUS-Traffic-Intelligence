import React from 'react';
import {
  Car,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  Play,
  BarChart2,
  AlertTriangle,
} from 'lucide-react';
import { Approach, ControllerDecision, PhaseType, SignalStatus, SimulationMetrics, Vehicle } from '../types';
import { MetricCard } from '../components/MetricCard';
import { IntersectionSimulator } from '../components/IntersectionSimulator';

interface OverviewPageProps {
  metrics: SimulationMetrics;
  vehicles: Record<Approach, Vehicle[]>;
  signals: Record<Approach, SignalStatus>;
  currentPhase: PhaseType;
  controllerType: 'FIXED' | 'ADAPTIVE';
  lastDecision: ControllerDecision | null;
  isRunning: boolean;
  onStartSim: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  metrics,
  vehicles,
  signals,
  currentPhase,
  controllerType,
  lastDecision,
  isRunning,
  onStartSim,
  onNavigateToTab,
}) => {
  const phasePrefix = currentPhase.split('_')[0];
  const isYellow = currentPhase.endsWith('_YELLOW');
  const isAllRed = currentPhase === 'ALL_RED';
  const phaseLabel = isAllRed
    ? 'ALL-RED CLEARANCE'
    : phasePrefix === 'NS'
    ? `NORTH-SOUTH AXIS (${isYellow ? 'YELLOW' : 'GREEN'})`
    : phasePrefix === 'EW'
    ? `EAST-WEST AXIS (${isYellow ? 'YELLOW' : 'GREEN'})`
    : `${phasePrefix} APPROACH (${isYellow ? 'YELLOW' : 'GREEN'})`;

  const remainingTime =
    phasePrefix === 'NS'
      ? signals.N?.remainingTime || 0
      : phasePrefix === 'EW'
      ? signals.E?.remainingTime || 0
      : signals[phasePrefix as Approach]?.remainingTime || 0;

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome Banner */}
      <div
        className="nexus-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 24, 38, 0.95), rgba(15, 23, 42, 0.85))',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-cyan">
              <Sparkles size={12} />
              B.Tech CSE Capstone
            </span>
            <span className={`badge ${controllerType === 'ADAPTIVE' ? 'badge-emerald' : 'badge-amber'}`}>
              Mode: {controllerType}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            NEXUS Traffic Intelligence Command Center
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Autonomous signal optimization engine balancing real-time queue pressure, waiting-time constraints, and zero-conflict safety guarantees.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isRunning && (
            <button onClick={onStartSim} className="nexus-btn nexus-btn-primary">
              <Play size={16} fill="currentColor" />
              Launch Simulation
            </button>
          )}
          <button onClick={() => onNavigateToTab('comparison')} className="nexus-btn nexus-btn-cyan">
            <TrendingUp size={16} />
            Compare Controllers
          </button>
          <button onClick={() => onNavigateToTab('analytics')} className="nexus-btn nexus-btn-secondary">
            <BarChart2 size={16} />
            Full Analytics
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <MetricCard
          title="Total Vehicles Processed"
          value={metrics.totalGenerated}
          unit="veh"
          icon={Car}
          iconColor="#38bdf8"
          subtext={`Served: ${metrics.totalServed}`}
          deltaText={`${Math.round((metrics.totalServed / Math.max(1, metrics.totalGenerated)) * 100)}% throughput`}
          deltaType="positive"
        />

        <MetricCard
          title="Vehicles Currently Queued"
          value={metrics.currentQueued}
          unit="stopped"
          icon={Layers}
          iconColor={metrics.currentQueued > 15 ? '#f59e0b' : '#34d399'}
          subtext={`N:${metrics.approachQueues.N} S:${metrics.approachQueues.S} E:${metrics.approachQueues.E} W:${metrics.approachQueues.W}`}
          deltaText={metrics.currentQueued > 20 ? 'High Queue' : 'Normal'}
          deltaType={metrics.currentQueued > 20 ? 'negative' : 'neutral'}
        />

        <MetricCard
          title="Average Waiting Time"
          value={metrics.avgWaitingTime}
          unit="sec"
          icon={Clock}
          iconColor="#fbbf24"
          subtext={`Median: ${metrics.medianWaitingTime}s | p95: ${metrics.p95WaitingTime}s`}
          deltaText={metrics.avgWaitingTime < 20 ? 'Optimal' : metrics.avgWaitingTime < 35 ? 'Moderate' : 'Heavy'}
          deltaType={metrics.avgWaitingTime < 20 ? 'positive' : 'negative'}
        />

        <MetricCard
          title="Maximum Observed Wait"
          value={metrics.maxWaitingTime}
          unit="sec"
          icon={AlertTriangle}
          iconColor={metrics.maxWaitingTime > 50 ? '#ef4444' : '#38bdf8'}
          subtext="Starvation threshold: 50s"
          deltaText={metrics.maxWaitingTime > 50 ? 'Preemption Fired' : 'Within Limits'}
          deltaType={metrics.maxWaitingTime > 50 ? 'negative' : 'positive'}
        />

        <MetricCard
          title="Throughput Rate"
          value={metrics.throughputPerMin}
          unit="veh/min"
          icon={TrendingUp}
          iconColor="#34d399"
          subtext={`Phase Changes: ${metrics.phaseChangeCount}`}
          deltaText={`${metrics.totalServed} vehicles cleared`}
          deltaType="positive"
        />
      </div>

      {/* Main Grid: Live Intersection Simulator & Quick Control Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Intersection Preview */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Live Intersection View</h2>
            </div>
            <button onClick={() => onNavigateToTab('simulation')} className="nexus-btn nexus-btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
              Full Screen Simulator <ArrowUpRight size={14} />
            </button>
          </div>

          <IntersectionSimulator
            vehicles={vehicles}
            signals={signals}
            currentPhase={currentPhase}
            showLabels={false}
          />
        </div>

        {/* Right Column: Status & Recent Decisions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Signal Phase Status Card */}
          <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Signal Phase
            </h3>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Right-of-Way Axis</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: isAllRed ? '#ef4444' : isYellow ? '#fbbf24' : '#34d399' }}>
                  {phaseLabel}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phase Remaining</p>
                <p
                  className="tabular-nums"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#ffffff',
                  }}
                >
                  {remainingTime}s
                </p>
              </div>
            </div>

            {/* Approach Queue Breakdown Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {(['N', 'S', 'E', 'W'] as Approach[]).map((app) => {
                const q = metrics.approachQueues[app];
                const maxBar = Math.max(10, metrics.currentQueued);
                const percent = Math.min(100, Math.round((q / maxBar) * 100));
                const isGreen = signals[app].state === 'GREEN';

                return (
                  <div key={app} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 600, color: isGreen ? '#34d399' : 'var(--text-secondary)' }}>
                        {app} Approach {isGreen ? '• (Active Green)' : ''}
                      </span>
                      <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {q} vehicles waiting
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-canvas)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          backgroundColor: isGreen ? '#10b981' : q > 8 ? '#f59e0b' : '#38bdf8',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Last Controller Rationale Card */}
          <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={16} color="#38bdf8" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Controller Explainability Rationale
                </h3>
              </div>
              <span className="badge badge-muted">Explainable AI</span>
            </div>

            <div
              style={{
                padding: '0.85rem',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.825rem',
                color: 'var(--text-primary)',
                lineHeight: '1.5',
              }}
            >
              {lastDecision ? (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '4px', color: '#38bdf8' }}>
                    Decision #{lastDecision.id} @ {lastDecision.timestamp.toFixed(1)}s:
                  </p>
                  <p style={{ color: 'var(--text-secondary)' }}>{lastDecision.rationale}</p>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>Waiting for first controller dispatch tick...</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => onNavigateToTab('logs')} className="nexus-btn nexus-btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                View Full Audit Logs <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
