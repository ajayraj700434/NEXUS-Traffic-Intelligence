import React, { useState } from 'react';
import {
  GitCompare,
  Play,
  Download,
  Sparkles,
  CheckCircle2,
  Clock,
  Car,
  Layers,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ComparisonReport, SimulationConfig } from '../types';
import { ComparisonRunner } from '../analytics/comparisonEngine';
import { CsvExporter } from '../analytics/csvExport';
import { SCENARIO_PRESETS } from '../simulation/scenarios';

interface ComparisonLabPageProps {
  currentConfig: SimulationConfig;
}

export const ComparisonLabPage: React.FC<ComparisonLabPageProps> = ({ currentConfig }) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('morning-rush');
  const [horizon, setHorizon] = useState<number>(300); // 5 min default
  const [seed, setSeed] = useState<number>(42);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [report, setReport] = useState<ComparisonReport | null>(() => {
    // Run initial benchmark on mount so user sees immediate results
    const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush') || SCENARIO_PRESETS[0];
    const initialConfig: SimulationConfig = {
      ...currentConfig,
      ...preset.config,
      simulationDuration: 300,
    };
    return ComparisonRunner.runExperiment(initialConfig, preset.name);
  });

  const handleRunExperiment = () => {
    setIsRunning(true);
    setProgress(0);

    const preset = SCENARIO_PRESETS.find((s) => s.id === selectedScenarioId) || SCENARIO_PRESETS[0];
    const testConfig: SimulationConfig = {
      ...currentConfig,
      ...preset.config,
      simulationDuration: horizon,
      seed,
    };

    // Run experiment with small async yield so progress UI renders
    setTimeout(() => {
      const result = ComparisonRunner.runExperiment(testConfig, preset.name, (p) => {
        setProgress(p);
      });
      setReport(result);
      setIsRunning(false);
    }, 100);
  };

  const handleExportCsv = () => {
    if (report) {
      CsvExporter.exportComparisonToCsv(report);
    }
  };

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div
        className="nexus-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(16, 24, 38, 0.95), rgba(15, 23, 42, 0.85))',
          border: '1px solid rgba(6, 182, 212, 0.25)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCompare size={20} color="#38bdf8" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              Dual Controller Comparison Lab
            </h1>
            <span className="badge badge-emerald">Deterministic Seeded Matrix</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Side-by-side experimental evaluation between Fixed-Time baseline and Adaptive Signal Agent under identical vehicle arrival streams.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleRunExperiment}
            disabled={isRunning}
            className="nexus-btn nexus-btn-primary"
          >
            <Play size={16} fill="currentColor" />
            {isRunning ? `Simulating (${progress}%)...` : 'Run Comparison Test'}
          </button>

          {report && (
            <button onClick={handleExportCsv} className="nexus-btn nexus-btn-secondary">
              <Download size={16} />
              Export CSV Report
            </button>
          )}
        </div>
      </div>

      {/* Experiment Controls Config Card */}
      <div
        className="nexus-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Scenario Preset
          </label>
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.825rem',
            }}
          >
            {SCENARIO_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.badge})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Horizon Duration: <span style={{ color: '#38bdf8' }}>{horizon}s</span> ({Math.round(horizon / 60)} mins)
          </label>
          <input
            type="range"
            min="60"
            max="600"
            step="60"
            value={horizon}
            onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#06b6d4' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            PRNG Random Seed: <span style={{ color: '#38bdf8' }}>{seed}</span>
          </label>
          <input
            type="number"
            min="1"
            max="99999"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)}
            style={{
              width: '100%',
              padding: '0.55rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.825rem',
            }}
          />
        </div>
      </div>

      {/* Results View */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Automated Algorithmic Interpretation Callout */}
          <div
            className="nexus-card"
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <Sparkles size={24} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                Algorithmic Evaluation Interpretation ({report.scenarioName})
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {report.interpretation}
              </p>
            </div>
          </div>

          {/* Side-by-Side KPI Cards Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {/* Average Waiting Time */}
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  AVERAGE WAITING TIME
                </span>
                <Clock size={16} color="#fbbf24" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'baseline' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Fixed-Time</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                    {report.fixed.avgWaitingTime}s
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Adaptive Agent</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                    {report.adaptive.avgWaitingTime}s
                  </p>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: report.deltas.avgWaitPercent <= 0 ? '#34d399' : '#f87171',
                }}
              >
                {report.deltas.avgWaitPercent <= 0
                  ? `↓ ${Math.abs(report.deltas.avgWaitPercent)}% Reduction in Wait Time`
                  : `↑ +${report.deltas.avgWaitPercent}% Higher Wait Time`}
              </div>
            </div>

            {/* Maximum Waiting Time */}
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  MAX OBSERVED WAIT
                </span>
                <AlertCircle size={16} color="#ef4444" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'baseline' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Fixed-Time</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                    {report.fixed.maxWaitingTime}s
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Adaptive Agent</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                    {report.adaptive.maxWaitingTime}s
                  </p>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: report.deltas.maxWaitPercent <= 0 ? '#34d399' : '#f87171',
                }}
              >
                {report.deltas.maxWaitPercent <= 0
                  ? `↓ ${Math.abs(report.deltas.maxWaitPercent)}% Lower Worst-Case Delay`
                  : `↑ +${report.deltas.maxWaitPercent}% Max Delay`}
              </div>
            </div>

            {/* Total Vehicles Served */}
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  VEHICLES SERVED
                </span>
                <Car size={16} color="#38bdf8" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'baseline' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Fixed-Time</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    {report.fixed.totalServed}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Adaptive Agent</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                    {report.adaptive.totalServed}
                  </p>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: report.deltas.servedPercent >= 0 ? '#34d399' : '#f87171',
                }}
              >
                {report.deltas.servedPercent >= 0
                  ? `↑ +${report.deltas.servedPercent}% Higher Throughput Clearance`
                  : `↓ ${Math.abs(report.deltas.servedPercent)}% Lower Throughput Clearance`}
              </div>
            </div>

            {/* Remaining Queue Backlog */}
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  REMAINING QUEUE BACKLOG
                </span>
                <Layers size={16} color="#34d399" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'baseline' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Fixed-Time</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                    {report.fixed.remainingQueue}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Adaptive Agent</p>
                  <p className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                    {report.adaptive.remainingQueue}
                  </p>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: report.deltas.queuePercent <= 0 ? '#34d399' : '#f87171',
                }}
              >
                {report.deltas.queuePercent <= 0
                  ? `↓ ${Math.abs(report.deltas.queuePercent)}% Less Residual Congestion`
                  : `↑ +${report.deltas.queuePercent}% Residual`}
              </div>
            </div>
          </div>

          {/* Time Series Comparison Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem' }}>
            {/* Chart: Total Queue Length Trajectory */}
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Queue Length Trajectory (Fixed vs Adaptive)
              </h3>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} unit="s" />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: 'rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="queueFixed" name="Fixed-Time Queue" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="queueAdaptive" name="Adaptive Agent Queue" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart: Cumulative Vehicles Served */}
            <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Cumulative Vehicle Throughput (Fixed vs Adaptive)
              </h3>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} unit="s" />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: 'rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="servedFixed" name="Fixed-Time Served" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="servedAdaptive" name="Adaptive Agent Served" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
