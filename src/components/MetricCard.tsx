import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  iconColor?: string;
  deltaText?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  subtext?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  iconColor = '#38bdf8',
  deltaText,
  deltaType = 'neutral',
  subtext,
}) => {
  return (
    <div className="nexus-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        <div
          style={{
            padding: '6px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: iconColor,
          }}
        >
          <Icon size={16} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span
          className="tabular-nums"
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
        {subtext && <span style={{ color: 'var(--text-muted)' }}>{subtext}</span>}
        {deltaText && (
          <span
            style={{
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor:
                deltaType === 'positive'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : deltaType === 'negative'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(255, 255, 255, 0.05)',
              color:
                deltaType === 'positive'
                  ? '#34d399'
                  : deltaType === 'negative'
                  ? '#f87171'
                  : 'var(--text-secondary)',
            }}
          >
            {deltaText}
          </span>
        )}
      </div>
    </div>
  );
};
