import React, { useMemo } from 'react';
import { Approach, PhaseType, SignalStatus, Vehicle } from '../types';

interface IntersectionSimulatorProps {
  vehicles: Record<Approach, Vehicle[]>;
  signals: Record<Approach, SignalStatus>;
  currentPhase: PhaseType;
  showLabels?: boolean;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (v: Vehicle | null) => void;
}

export const IntersectionSimulator: React.FC<IntersectionSimulatorProps> = ({
  vehicles,
  signals,
  currentPhase,
  showLabels = false,
  selectedVehicleId = null,
  onSelectVehicle,
}) => {
  // SVG Canvas Dimension: 600 x 600
  // Center of intersection: (300, 300)
  // Road width: 120px (2 lanes of 60px each: 1 inbound, 1 outbound)
  // Intersection box: (240, 240) to (360, 360)
  // Inbound lane centerlines:
  //   North Inbound: x = 270 (moving South: y from 0 to 240, stop line at y = 240)
  //   North Outbound: x = 330 (moving North: y from 240 to 0)
  //   South Inbound: x = 330 (moving North: y from 600 to 360, stop line at y = 360)
  //   South Outbound: x = 270 (moving South: y from 360 to 600)
  //   East Inbound: y = 270 (moving West: x from 600 to 360, stop line at x = 360)
  //   East Outbound: y = 330 (moving East: x from 360 to 600)
  //   West Inbound: y = 330 (moving East: x from 0 to 240, stop line at x = 240)
  //   West Outbound: y = 270 (moving West: x from 240 to 0)

  // Map vehicle distance (0 to 380) to (x, y, rotation) so vehicles traverse full routes without disappearing prematurely
  const getMappedOffset = (dist: number): number => {
    // 0 -> 180 maps to approach lane: 50 -> 238 (stop line)
    if (dist <= 180) {
      return 50 + (dist / 180) * (238 - 50);
    }
    // 180 -> 260 maps to intersection box: 238 -> 362 (exit of intersection)
    if (dist <= 260) {
      return 238 + ((dist - 180) / (260 - 180)) * (362 - 238);
    }
    // 260 -> 380 maps to outbound exit road: 362 -> 580 (canvas edge boundary)
    return 362 + ((Math.min(dist, 380) - 260) / (380 - 260)) * (580 - 362);
  };

  const getVehicleCoordinates = (v: Vehicle): { x: number; y: number; angle: number } => {
    const dist = v.distance; // 0 (start) -> 180 (stop line) -> 260 (crossing) -> 380 (exit boundary)
    const offset = getMappedOffset(dist);
    let x = 0;
    let y = 0;
    let angle = 0;

    switch (v.approach) {
      case 'N':
        x = 270;
        y = offset;
        angle = 0;
        break;
      case 'S':
        x = 330;
        y = 600 - offset;
        angle = 180;
        break;
      case 'E':
        x = 600 - offset;
        y = 270;
        angle = 90;
        break;
      case 'W':
        x = offset;
        y = 330;
        angle = 270;
        break;
    }

    return { x, y, angle };
  };

  const allVehiclesList = useMemo(() => {
    return [
      ...vehicles.N,
      ...vehicles.S,
      ...vehicles.E,
      ...vehicles.W,
    ];
  }, [vehicles]);

  const queueCounts = useMemo(() => {
    return {
      N: vehicles.N.filter((v) => v.state === 'queued').length,
      S: vehicles.S.filter((v) => v.state === 'queued').length,
      E: vehicles.E.filter((v) => v.state === 'queued').length,
      W: vehicles.W.filter((v) => v.state === 'queued').length,
    };
  }, [vehicles]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '680px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        backgroundColor: '#070b12',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.7)',
      }}
    >
      <svg
        viewBox="0 0 600 600"
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label="4-Way Smart Traffic Intersection Simulator"
      >
        <defs>
          {/* Subtle Grid Pattern for Grass/Surrounding */}
          <pattern id="urbanGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
          </pattern>

          {/* Glow Filters */}
          <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* City Blocks Background */}
        <rect width="600" height="600" fill="#090e18" />
        <rect width="600" height="600" fill="url(#urbanGrid)" />

        {/* Sidewalk curbs and corner pavements */}
        <rect x="0" y="0" width="236" height="236" rx="8" fill="#111827" stroke="#1f293d" strokeWidth="2" />
        <rect x="364" y="0" width="236" height="236" rx="8" fill="#111827" stroke="#1f293d" strokeWidth="2" />
        <rect x="0" y="364" width="236" height="236" rx="8" fill="#111827" stroke="#1f293d" strokeWidth="2" />
        <rect x="364" y="364" width="236" height="236" rx="8" fill="#111827" stroke="#1f293d" strokeWidth="2" />

        {/* ROADS ASPHALT */}
        {/* North-South Road */}
        <rect x="238" y="0" width="124" height="600" fill="#0f172a" />
        {/* East-West Road */}
        <rect x="0" y="238" width="600" height="124" fill="#0f172a" />

        {/* INTERSECTION CENTER BOX */}
        <rect x="238" y="238" width="124" height="124" fill="#0b1322" />

        {/* ROAD MARKINGS */}
        {/* North Centerline (Double yellow) */}
        <line x1="298" y1="0" x2="298" y2="230" stroke="#f59e0b" strokeWidth="2" />
        <line x1="302" y1="0" x2="302" y2="230" stroke="#f59e0b" strokeWidth="2" />

        {/* South Centerline (Double yellow) */}
        <line x1="298" y1="370" x2="298" y2="600" stroke="#f59e0b" strokeWidth="2" />
        <line x1="302" y1="370" x2="302" y2="600" stroke="#f59e0b" strokeWidth="2" />

        {/* East Centerline (Double yellow) */}
        <line x1="370" y1="298" x2="600" y2="298" stroke="#f59e0b" strokeWidth="2" />
        <line x1="370" y1="302" x2="600" y2="302" stroke="#f59e0b" strokeWidth="2" />

        {/* West Centerline (Double yellow) */}
        <line x1="0" y1="298" x2="230" y2="298" stroke="#f59e0b" strokeWidth="2" />
        <line x1="0" y1="302" x2="230" y2="302" stroke="#f59e0b" strokeWidth="2" />

        {/* CROSSWALKS (Zebra Stripes) */}
        {/* North Crosswalk */}
        {[242, 252, 262, 272, 282, 292, 302, 312, 322, 332, 342, 352].map((x) => (
          <rect key={`nw-${x}`} x={x} y="222" width="6" height="14" fill="#ffffff" opacity="0.25" rx="1" />
        ))}
        {/* South Crosswalk */}
        {[242, 252, 262, 272, 282, 292, 302, 312, 322, 332, 342, 352].map((x) => (
          <rect key={`sw-${x}`} x={x} y="364" width="6" height="14" fill="#ffffff" opacity="0.25" rx="1" />
        ))}
        {/* East Crosswalk */}
        {[242, 252, 262, 272, 282, 292, 302, 312, 322, 332, 342, 352].map((y) => (
          <rect key={`ew-${y}`} x="364" y={y} width="14" height="6" fill="#ffffff" opacity="0.25" rx="1" />
        ))}
        {/* West Crosswalk */}
        {[242, 252, 262, 272, 282, 292, 302, 312, 322, 332, 342, 352].map((y) => (
          <rect key={`ww-${y}`} x="222" y={y} width="14" height="6" fill="#ffffff" opacity="0.25" rx="1" />
        ))}

        {/* STOP LINES (Solid white lines across inbound lane) */}
        {/* North Stop Line */}
        <line x1="238" y1="238" x2="300" y2="238" stroke="#ffffff" strokeWidth="4" />
        {/* South Stop Line */}
        <line x1="300" y1="362" x2="362" y2="362" stroke="#ffffff" strokeWidth="4" />
        {/* East Stop Line */}
        <line x1="362" y1="238" x2="362" y2="300" stroke="#ffffff" strokeWidth="4" />
        {/* West Stop Line */}
        <line x1="238" y1="300" x2="238" y2="362" stroke="#ffffff" strokeWidth="4" />

        {/* DIRECTION ARROWS ON LANES */}
        {/* North Approach Label & Arrow */}
        <g opacity="0.4">
          <text x="270" y="100" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle">
            NORTH ↓
          </text>
          <text x="330" y="520" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle">
            SOUTH ↑
          </text>
          <text x="520" y="275" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle">
            ← EAST
          </text>
          <text x="90" y="335" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle">
            WEST →
          </text>
        </g>

        {/* TRAFFIC SIGNALS (L-shaped pole heads at corners) */}
        {/* North Signal (at corner x=224, y=205) */}
        <TrafficSignalHead
          x={210}
          y={190}
          approach="N"
          status={signals.N}
          currentPhase={currentPhase}
          align="vertical"
        />

        {/* South Signal (at corner x=372, y=375) */}
        <TrafficSignalHead
          x={372}
          y={375}
          approach="S"
          status={signals.S}
          currentPhase={currentPhase}
          align="vertical"
        />

        {/* East Signal (at corner x=375, y=210) */}
        <TrafficSignalHead
          x={375}
          y={205}
          approach="E"
          status={signals.E}
          currentPhase={currentPhase}
          align="horizontal"
        />

        {/* West Signal (at corner x=190, y=375) */}
        <TrafficSignalHead
          x={190}
          y={375}
          approach="W"
          status={signals.W}
          currentPhase={currentPhase}
          align="horizontal"
        />

        {/* QUEUE COUNT PILLS */}
        <QueueBadge x={268} y={150} count={queueCounts.N} label="N" />
        <QueueBadge x={332} y={450} count={queueCounts.S} label="S" />
        <QueueBadge x={450} y={268} count={queueCounts.E} label="E" />
        <QueueBadge x={150} y={332} count={queueCounts.W} label="W" />

        {/* VEHICLES RENDERING */}
        {allVehiclesList.map((v) => {
          const { x, y, angle } = getVehicleCoordinates(v);
          const isSelected = v.id === selectedVehicleId;

          return (
            <VehicleShape
              key={v.id}
              vehicle={v}
              x={x}
              y={y}
              angle={angle}
              showLabel={showLabels}
              isSelected={isSelected}
              onClick={() => onSelectVehicle?.(isSelected ? null : v)}
            />
          );
        })}
      </svg>
    </div>
  );
};

// Sub-components
const TrafficSignalHead: React.FC<{
  x: number;
  y: number;
  approach: Approach;
  status: SignalStatus;
  currentPhase: PhaseType;
  align: 'vertical' | 'horizontal';
}> = ({ x, y, approach, status }) => {
  const isRed = status.state === 'RED';
  const isYellow = status.state === 'YELLOW';
  const isGreen = status.state === 'GREEN';

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Signal housing box */}
      <rect
        x="0"
        y="0"
        width="26"
        height="64"
        rx="5"
        fill="#0f172a"
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}
      />
      {/* Visor shield */}
      <path d="M 2 0 Q 13 -4 24 0" stroke="#334155" strokeWidth="2" fill="none" />

      {/* Red Light */}
      <circle
        cx="13"
        cy="12"
        r="7"
        fill={isRed ? '#ef4444' : '#2d1515'}
        stroke={isRed ? '#f87171' : 'none'}
        strokeWidth="1.5"
        filter={isRed ? 'url(#glowRed)' : undefined}
      />

      {/* Yellow Light */}
      <circle
        cx="13"
        cy="32"
        r="7"
        fill={isYellow ? '#f59e0b' : '#2b200d'}
        stroke={isYellow ? '#fbbf24' : 'none'}
        strokeWidth="1.5"
        filter={isYellow ? 'url(#glowYellow)' : undefined}
      />

      {/* Green Light */}
      <circle
        cx="13"
        cy="52"
        r="7"
        fill={isGreen ? '#10b981' : '#0d281e'}
        stroke={isGreen ? '#34d399' : 'none'}
        strokeWidth="1.5"
        filter={isGreen ? 'url(#glowGreen)' : undefined}
      />

      {/* Remaining timer badge */}
      {status.state !== 'RED' && (
        <g transform="translate(32, 22)">
          <rect
            x="-4"
            y="-14"
            width="34"
            height="22"
            rx="4"
            fill="rgba(15, 23, 42, 0.95)"
            stroke={isGreen ? '#10b981' : '#f59e0b'}
            strokeWidth="1.5"
          />
          <text
            x="13"
            y="2"
            fill={isGreen ? '#34d399' : '#fbbf24'}
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {status.remainingTime}s
          </text>
        </g>
      )}

      {/* Approach Indicator */}
      <text
        x="13"
        y="-6"
        fill="#94a3b8"
        fontSize="10"
        fontWeight="800"
        textAnchor="middle"
      >
        {approach}
      </text>
    </g>
  );
};

const QueueBadge: React.FC<{ x: number; y: number; count: number; label: string }> = ({
  x,
  y,
  count,
  label,
}) => {
  if (count === 0) return null;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="-24"
        y="-12"
        width="48"
        height="22"
        rx="11"
        fill="rgba(15, 23, 42, 0.9)"
        stroke={count > 5 ? '#f59e0b' : '#38bdf8'}
        strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
      />
      <text
        x="0"
        y="3"
        fill="#ffffff"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
      >
        {label}: {count}
      </text>
    </g>
  );
};

const VehicleShape: React.FC<{
  vehicle: Vehicle;
  x: number;
  y: number;
  angle: number;
  showLabel: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ vehicle, x, y, angle, showLabel, isSelected, onClick }) => {
  const isEmergency = vehicle.isEmergency;
  const isBus = vehicle.type === 'bus';
  const isTruck = vehicle.type === 'truck';

  // Sizing
  const width = isBus ? 18 : isTruck ? 18 : 16;
  const length = isBus ? 36 : isTruck ? 32 : 24;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${angle})`}
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'all 0.1s linear' }}
    >
      {/* Selected Indicator Outline */}
      {isSelected && (
        <rect
          x={-width / 2 - 4}
          y={-length / 2 - 4}
          width={width + 8}
          height={length + 8}
          rx="6"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
      )}

      {/* Vehicle Body */}
      <rect
        x={-width / 2}
        y={-length / 2}
        width={width}
        height={length}
        rx={isBus ? 4 : 5}
        fill={isEmergency ? '#dc2626' : vehicle.color}
        stroke={isEmergency ? '#fca5a5' : 'rgba(255, 255, 255, 0.3)'}
        strokeWidth="1"
        style={{
          filter: isEmergency
            ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))'
            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
        }}
      />

      {/* Windshield */}
      <rect
        x={-width / 2 + 2}
        y={length / 2 - 7}
        width={width - 4}
        height="4"
        rx="1"
        fill="#0f172a"
        opacity="0.8"
      />

      {/* Rear Window */}
      <rect
        x={-width / 2 + 2}
        y={-length / 2 + 3}
        width={width - 4}
        height="3"
        rx="1"
        fill="#0f172a"
        opacity="0.8"
      />

      {/* Headlights (at front) */}
      <circle cx={-width / 2 + 3} cy={length / 2 - 1} r="1.5" fill="#fef08a" />
      <circle cx={width / 2 - 3} cy={length / 2 - 1} r="1.5" fill="#fef08a" />

      {/* Emergency Siren Beacon */}
      {isEmergency && (
        <circle
          cx="0"
          cy="0"
          r="4"
          fill="#ef4444"
          stroke="#ffffff"
          strokeWidth="1"
          style={{ filter: 'url(#glowRed)' }}
        />
      )}

      {/* Optional Vehicle ID Label */}
      {showLabel && (
        <g transform={`rotate(${-angle})`}>
          <rect
            x="-20"
            y="-22"
            width="40"
            height="14"
            rx="3"
            fill="rgba(15, 23, 42, 0.9)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.8"
          />
          <text
            x="0"
            y="-12"
            fill="#ffffff"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
          >
            {vehicle.id}
          </text>
        </g>
      )}
    </g>
  );
};
