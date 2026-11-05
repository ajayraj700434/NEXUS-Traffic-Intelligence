import React from 'react';
import {
  LayoutDashboard,
  PlayCircle,
  BarChart3,
  GitCompare,
  ScrollText,
  SlidersHorizontal,
  GraduationCap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'simulation'
  | 'analytics'
  | 'comparison'
  | 'logs'
  | 'scenarios'
  | 'about';

interface NavigationSidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  controllerMode: 'FIXED' | 'ADAPTIVE';
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  controllerMode,
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'simulation', label: 'Live Simulation', icon: PlayCircle },
    { id: 'analytics', label: 'Traffic Analytics', icon: BarChart3 },
    { id: 'comparison', label: 'Comparison Lab', icon: GitCompare },
    { id: 'logs', label: 'Decision Logs', icon: ScrollText },
    { id: 'scenarios', label: 'Scenarios & Config', icon: SlidersHorizontal },
    { id: 'about', label: 'Project & Viva Guide', icon: GraduationCap },
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? '72px' : '260px',
        backgroundColor: 'var(--bg-canvas)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 50,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: '1.25rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} color="#ffffff" />
          </div>
          {!isCollapsed && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(to right, #f8fafc, #94a3b8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  NEXUS
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: controllerMode === 'ADAPTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: controllerMode === 'ADAPTIVE' ? '#34d399' : '#fbbf24',
                    border: `1px solid ${controllerMode === 'ADAPTIVE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  }}
                >
                  {controllerMode}
                </span>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Traffic Intelligence</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as NavTab)}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: isCollapsed ? '0.75rem 0' : '0.65rem 0.85rem',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={18} color={isActive ? '#38bdf8' : 'currentColor'} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer / Academic Badge */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              padding: '0.65rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              B.Tech CSE (AI & ML)
            </p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Academic Capstone Project
            </p>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="nexus-btn nexus-btn-icon"
          style={{ width: '100%', justifyContent: 'center' }}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
