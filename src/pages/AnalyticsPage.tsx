import React, { useMemo } from 'react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart2,
  Clock,
  TrendingUp,
  Layers,
  PieChart as PieIcon,
  Download,
} from 'lucide-react';
import { Approach, SimulationMetrics } from '../types';
import { CsvExporter } from '../analytics/csvExport';

interface AnalyticsPageProps {
  metrics: SimulationMetrics;
  history: Array<{
    time: number;
    queueN: number;
    queueS: number;
    queueE: number;
    queueW: number;
    totalQueued: number;
    avgWait: number;
    throughput: number;
    served: number;
  }>;
}

const APPROACH_COLORS: Record<Approach, string> = {
  N: '#38bdf8', // Blue
  S: '#818cf8', // Indigo
  E: '#34d399', // Mint
  W: '#fbbf24', // Amber
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ metrics, history }) => {
  // Distribution by approach
  const trafficDistributionData = useMemo(() => {
    return [
      { name: 'North Approach', value: metrics.approachServed.N + metrics.approachQueues.N, approach: 'N' },
      { name: 'South Approach', value: metrics.approachServed.S + metrics.approachQueues.S, approach: 'S' },
      { name: 'East Approach', value: metrics.approachServed.E + metrics.approachQueues.E, approach: 'E' },
      { name: 'West Approach', value: metrics.approachServed.W + metrics.approachQueues.W, approach: 'W' },
    ];
  }, [metrics]);

  // Wait time distribution by approach
  const waitByApproachData = useMemo(() => {
    return (['N', 'S', 'E', 'W'] as Approach[]).map((app) => {
      const waits = metrics.approachWaitTimes[app] || [];
      const avg = waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
      const max = waits.length > 0 ? Math.max(...waits) : 0;
      return {
        approach: `${app} Approach`,
        avgWait: Math.round(avg * 10) / 10,
        maxWait: Math.round(max * 10) / 10,
        servedCount: metrics.approachServed[app],
      };
    });
  }, [metrics]);

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Bar */}
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
            <BarChart2 size={20} color="#38bdf8" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              Traffic Density & Operational Analytics
            </h1>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Empirical measurements sampled throughout active simulation execution.
          </p>
        </div>

        <button
          onClick={() => CsvExporter.exportMetricsToCsv(metrics)}
          className="nexus-btn nexus-btn-secondary"
        >
          <Download size={16} />
          Export Metrics CSV
        </button>
      </div>

      {/* Grid: 2 columns of rich charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem' }}>
        {/* Chart 1: Queue Length over Time by Approach */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} color="#38bdf8" />
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Queue Length Over Time (by Approach)
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Number of queued vehicles per approach over simulation seconds
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: '260px' }}>
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
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
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="queueN" name="North Queue" stroke={APPROACH_COLORS.N} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="queueS" name="South Queue" stroke={APPROACH_COLORS.S} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="queueE" name="East Queue" stroke={APPROACH_COLORS.E} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="queueW" name="West Queue" stroke={APPROACH_COLORS.W} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Start simulation to collect queue trajectory data...
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Average Waiting Time Progression */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="#fbbf24" />
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Average Waiting Time Progression
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Average seconds spent stationary before signal clearance
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: '260px' }}>
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} unit="s" />
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
                  <Line type="monotone" dataKey="avgWait" name="Average Wait (s)" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Run simulation to record waiting time progression...
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Waiting Time Comparison by Approach */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={16} color="#34d399" />
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Waiting Times & Clearance by Approach
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Average vs Maximum wait times across each direction
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waitByApproachData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="approach" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} unit="s" />
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
                <Bar dataKey="avgWait" name="Average Wait (s)" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxWait" name="Max Wait (s)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Traffic Volume Share by Approach */}
        <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieIcon size={16} color="#a78bfa" />
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
                Approach Volume Share
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Total vehicles processed per direction
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trafficDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ? name.split(' ')[0] : ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {trafficDistributionData.map((entry) => (
                    <Cell key={entry.name} fill={APPROACH_COLORS[entry.approach as Approach]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
