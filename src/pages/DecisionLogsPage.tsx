import React, { useState, useMemo } from 'react';
import {
  ScrollText,
  Filter,
  Search,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Approach, EventType, SimulationEvent } from '../types';
import { CsvExporter } from '../analytics/csvExport';

interface DecisionLogsPageProps {
  events: SimulationEvent[];
  onClearLogs?: () => void;
}

export const DecisionLogsPage: React.FC<DecisionLogsPageProps> = ({ events, onClearLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedApproach, setSelectedApproach] = useState<string>('ALL');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchType = selectedType === 'ALL' || e.type === selectedType;
      const matchApproach =
        selectedApproach === 'ALL' ||
        e.approach === selectedApproach ||
        (selectedApproach === 'NS' && (e.approach === 'N' || e.approach === 'S')) ||
        (selectedApproach === 'EW' && (e.approach === 'E' || e.approach === 'W'));
      const matchSearch =
        !searchQuery ||
        e.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchApproach && matchSearch;
    });
  }, [events, selectedType, selectedApproach, searchQuery]);

  const handleExportCsv = () => {
    CsvExporter.exportEventsToCsv(events);
  };

  const getSeverityBadge = (severity: SimulationEvent['severity']) => {
    switch (severity) {
      case 'alert':
        return <span className="badge badge-rose">ALERT</span>;
      case 'warning':
        return <span className="badge badge-amber">WARNING</span>;
      case 'success':
        return <span className="badge badge-emerald">SUCCESS</span>;
      default:
        return <span className="badge badge-muted">INFO</span>;
    }
  };

  return (
    <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title & Action Bar */}
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
            <ScrollText size={20} color="#38bdf8" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              Decision Logs & System Event Audit
            </h1>
            <span className="badge badge-cyan">{events.length} Recorded</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Chronological audit stream recording controller dispatches, queue events, phase changes, and starvation overrides.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportCsv} className="nexus-btn nexus-btn-secondary">
            <Download size={16} />
            Export CSV
          </button>

          {onClearLogs && (
            confirmClear ? (
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  onClick={() => {
                    onClearLogs();
                    setConfirmClear(false);
                  }}
                  className="nexus-btn nexus-btn-danger"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="nexus-btn nexus-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="nexus-btn nexus-btn-icon"
                title="Clear Logs"
              >
                <Trash2 size={16} />
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div
        className="nexus-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flex: '1 1 280px', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-canvas)', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search events, rationales, vehicle IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.825rem',
              width: '100%',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Event Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.825rem',
            }}
          >
            <option value="ALL">All Event Types</option>
            <option value="CONTROLLER_DECISION">Controller Decisions</option>
            <option value="PHASE_CHANGE">Phase Changes</option>
            <option value="VEHICLE_ARRIVED">Vehicle Arrivals</option>
            <option value="VEHICLE_QUEUED">Queue Stops</option>
            <option value="VEHICLE_DEPARTED">Vehicle Departures</option>
            <option value="STARVATION_ALERT">Starvation Alerts</option>
          </select>

          {/* Approach Filter */}
          <select
            value={selectedApproach}
            onChange={(e) => setSelectedApproach(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              color: '#ffffff',
              fontSize: '0.825rem',
            }}
          >
            <option value="ALL">All Approaches & Axes</option>
            <option value="NS">North-South Axis (Phase A)</option>
            <option value="EW">East-West Axis (Phase B)</option>
            <option value="N">North Approach</option>
            <option value="S">South Approach</option>
            <option value="E">East Approach</option>
            <option value="W">West Approach</option>
          </select>
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="nexus-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '580px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
            <thead style={{ backgroundColor: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>TIME (s)</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>SEVERITY</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>EVENT TYPE</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>APPROACH</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPLANATION & RATIONALE</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((e) => (
                  <tr
                    key={e.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td className="tabular-nums" style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                      {e.timestamp.toFixed(1)}s
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getSeverityBadge(e.severity)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                      {e.type.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge badge-muted">{e.approach}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {e.message}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No events matched the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
