import { Approach, MovementKey, MovementType, PhaseType, Vehicle } from '../types';

export const ALL_MOVEMENTS: MovementKey[] = [
  'N_STRAIGHT',
  'N_LEFT',
  'N_RIGHT',
  'S_STRAIGHT',
  'S_LEFT',
  'S_RIGHT',
  'E_STRAIGHT',
  'E_LEFT',
  'E_RIGHT',
  'W_STRAIGHT',
  'W_LEFT',
  'W_RIGHT',
];

/**
 * Returns the target departure approach for an inbound approach and movement.
 */
export function getTargetApproach(approach: Approach, movement: MovementType = 'STRAIGHT'): Approach {
  switch (approach) {
    case 'N':
      return movement === 'STRAIGHT' ? 'S' : movement === 'LEFT' ? 'E' : 'W';
    case 'S':
      return movement === 'STRAIGHT' ? 'N' : movement === 'LEFT' ? 'W' : 'E';
    case 'E':
      return movement === 'STRAIGHT' ? 'W' : movement === 'LEFT' ? 'S' : 'N';
    case 'W':
      return movement === 'STRAIGHT' ? 'E' : movement === 'LEFT' ? 'N' : 'S';
  }
}

export function getMovementKey(approach: Approach, movement: MovementType = 'STRAIGHT'): MovementKey {
  return `${approach}_${movement}`;
}

/**
 * Symmetric 12x12 Movement Conflict Matrix.
 * Two movements conflict (true) if their geometric swept envelopes through the intersection
 * intersect, merge into the same outbound lane, or cross each other's path.
 */
export const MOVEMENT_CONFLICT_MATRIX: Record<MovementKey, Record<MovementKey, boolean>> = (() => {
  const matrix: Record<string, Record<string, boolean>> = {};

  for (const m1 of ALL_MOVEMENTS) {
    matrix[m1] = {};
    for (const m2 of ALL_MOVEMENTS) {
      if (m1 === m2) {
        // Same movement type on same approach queues in single file
        matrix[m1][m2] = false;
        continue;
      }

      // Check conflict between m1 and m2
      const [app1, type1] = m1.split('_') as [Approach, MovementType];
      const [app2, type2] = m2.split('_') as [Approach, MovementType];

      if (app1 === app2) {
        // Same approach lane: different movements cannot execute concurrently side-by-side
        matrix[m1][m2] = true;
        continue;
      }

      const target1 = getTargetApproach(app1, type1);
      const target2 = getTargetApproach(app2, type2);

      // Merge conflict: two movements terminating at the same outbound lane
      if (target1 === target2) {
        matrix[m1][m2] = true;
        continue;
      }

      // Non-conflicting compatible movement pairs:
      // 1. Parallel straight flows on separated lanes
      if (
        (m1 === 'N_STRAIGHT' && m2 === 'S_STRAIGHT') ||
        (m1 === 'S_STRAIGHT' && m2 === 'N_STRAIGHT') ||
        (m1 === 'E_STRAIGHT' && m2 === 'W_STRAIGHT') ||
        (m1 === 'W_STRAIGHT' && m2 === 'E_STRAIGHT')
      ) {
        matrix[m1][m2] = false;
        continue;
      }

      // 2. Straight flow and right turns that do not intersect or merge
      if (
        (m1 === 'N_STRAIGHT' && (m2 === 'N_RIGHT' || m2 === 'S_RIGHT' || m2 === 'E_RIGHT')) ||
        (m2 === 'N_STRAIGHT' && (m1 === 'N_RIGHT' || m1 === 'S_RIGHT' || m1 === 'E_RIGHT')) ||
        (m1 === 'S_STRAIGHT' && (m2 === 'S_RIGHT' || m2 === 'N_RIGHT' || m2 === 'W_RIGHT')) ||
        (m2 === 'S_STRAIGHT' && (m1 === 'S_RIGHT' || m1 === 'N_RIGHT' || m1 === 'W_RIGHT')) ||
        (m1 === 'E_STRAIGHT' && (m2 === 'E_RIGHT' || m2 === 'W_RIGHT' || m2 === 'S_RIGHT')) ||
        (m2 === 'E_STRAIGHT' && (m1 === 'E_RIGHT' || m1 === 'W_RIGHT' || m1 === 'S_RIGHT')) ||
        (m1 === 'W_STRAIGHT' && (m2 === 'W_RIGHT' || m2 === 'E_RIGHT' || m2 === 'N_RIGHT')) ||
        (m2 === 'W_STRAIGHT' && (m1 === 'W_RIGHT' || m1 === 'E_RIGHT' || m1 === 'N_RIGHT'))
      ) {
        matrix[m1][m2] = false;
        continue;
      }

      // 3. Right turns in disjoint quadrants
      if (
        (type1 === 'RIGHT' && type2 === 'RIGHT')
      ) {
        matrix[m1][m2] = false;
        continue;
      }

      // 4. Dual protected left turns turning in front of each other without intersecting
      if (
        (m1 === 'N_LEFT' && m2 === 'S_LEFT') ||
        (m1 === 'S_LEFT' && m2 === 'N_LEFT') ||
        (m1 === 'E_LEFT' && m2 === 'W_LEFT') ||
        (m1 === 'W_LEFT' && m2 === 'E_LEFT')
      ) {
        matrix[m1][m2] = false;
        continue;
      }

      // All other pairs (such as opposing straight vs left turn, perpendicular straight crossings, etc.) conflict
      matrix[m1][m2] = true;
    }
  }

  return matrix as Record<MovementKey, Record<MovementKey, boolean>>;
})();

/**
 * Checks whether two movements conflict.
 */
export function areMovementsConflicting(m1: MovementKey, m2: MovementKey): boolean {
  if (m1 === m2) return false;
  return MOVEMENT_CONFLICT_MATRIX[m1]?.[m2] ?? true;
}

/**
 * Determines if a specific vehicle movement is permitted to enter the intersection
 * under the given signal phase.
 */
export function isMovementPermittedInPhase(
  approach: Approach,
  movement: MovementType = 'STRAIGHT',
  phase: PhaseType
): boolean {
  switch (phase) {
    // Phase A: North-South Straight & Right (Left turns held at RED)
    case 'NS_GREEN':
      if (approach === 'N' || approach === 'S') {
        return movement === 'STRAIGHT' || movement === 'RIGHT';
      }
      return false;

    // Phase A-Protected Left: North-South Left Turns (Straight held at RED)
    case 'NS_LEFT_GREEN':
      if (approach === 'N' || approach === 'S') {
        return movement === 'LEFT';
      }
      return false;

    // Phase B: East-West Straight & Right (Left turns held at RED)
    case 'EW_GREEN':
      if (approach === 'E' || approach === 'W') {
        return movement === 'STRAIGHT' || movement === 'RIGHT';
      }
      return false;

    // Phase B-Protected Left: East-West Left Turns (Straight held at RED)
    case 'EW_LEFT_GREEN':
      if (approach === 'E' || approach === 'W') {
        return movement === 'LEFT';
      }
      return false;

    // Legacy phases (single approach permitted)
    case 'N_GREEN':
      return approach === 'N' && (movement === 'STRAIGHT' || movement === 'RIGHT');
    case 'S_GREEN':
      return approach === 'S' && (movement === 'STRAIGHT' || movement === 'RIGHT');
    case 'E_GREEN':
      return approach === 'E' && (movement === 'STRAIGHT' || movement === 'RIGHT');
    case 'W_GREEN':
      return approach === 'W' && (movement === 'STRAIGHT' || movement === 'RIGHT');

    // Clearance intervals and RED
    case 'ALL_RED':
    case 'NS_YELLOW':
    case 'NS_LEFT_YELLOW':
    case 'EW_YELLOW':
    case 'EW_LEFT_YELLOW':
    case 'N_YELLOW':
    case 'S_YELLOW':
    case 'E_YELLOW':
    case 'W_YELLOW':
    default:
      return false;
  }
}

/**
 * Precise geometric coordinate mapping for all 12 movements across the 600x600 canvas.
 * Coordinates are mapped smoothly for:
 *   - Inbound approach (distance: 0 -> 180)
 *   - Intersection arc traversal (distance: 180 -> 260)
 *   - Outbound departure road (distance: 260 -> 380)
 */
export function calculateVehicleCoordinates(
  approach: Approach,
  movement: MovementType = 'STRAIGHT',
  distance: number
): { x: number; y: number; angle: number } {
  // Inbound approach segment (dist: 0 to 180)
  if (distance <= 180) {
    const inboundOffset = 50 + (distance / 180) * (238 - 50);
    switch (approach) {
      case 'N':
        return { x: 270, y: inboundOffset, angle: 0 };
      case 'S':
        return { x: 330, y: 600 - inboundOffset, angle: 180 };
      case 'E':
        return { x: 600 - inboundOffset, y: 270, angle: 90 };
      case 'W':
        return { x: inboundOffset, y: 330, angle: 270 };
    }
  }

  // Outbound departure road segment (dist: 260 to 380)
  if (distance >= 260) {
    const outT = (Math.min(distance, 380) - 260) / (380 - 260);
    const target = getTargetApproach(approach, movement);

    switch (target) {
      case 'S': // Exiting South outbound (x = 270, y moving down 362 -> 580)
        return { x: 270, y: 362 + outT * (580 - 362), angle: 0 };
      case 'N': // Exiting North outbound (x = 330, y moving up 238 -> 20)
        return { x: 330, y: 238 - outT * (238 - 20), angle: 180 };
      case 'E': // Exiting East outbound (y = 330, x moving right 362 -> 580)
        return { x: 362 + outT * (580 - 362), y: 330, angle: 270 };
      case 'W': // Exiting West outbound (y = 270, x moving left 238 -> 20)
        return { x: 238 - outT * (238 - 20), y: 270, angle: 90 };
    }
  }

  // Intersection traversal segment (180 < distance < 260)
  const t = (distance - 180) / (260 - 180); // normalized traversal progress [0, 1]

  if (movement === 'STRAIGHT') {
    const offset = 238 + t * (362 - 238);
    switch (approach) {
      case 'N':
        return { x: 270, y: offset, angle: 0 };
      case 'S':
        return { x: 330, y: 600 - offset, angle: 180 };
      case 'E':
        return { x: 600 - offset, y: 270, angle: 90 };
      case 'W':
        return { x: offset, y: 330, angle: 270 };
    }
  }

  if (movement === 'RIGHT') {
    // Tight right turn arc through the corner quadrant
    switch (approach) {
      case 'N': // Turn right into West Outbound (y=270, x=238)
        return {
          x: 270 - 32 * Math.sin((t * Math.PI) / 2),
          y: 238 + 32 * (1 - Math.cos((t * Math.PI) / 2)),
          angle: (360 - t * 90) % 360,
        };
      case 'S': // Turn right into East Outbound (y=330, x=362)
        return {
          x: 330 + 32 * Math.sin((t * Math.PI) / 2),
          y: 362 - 32 * (1 - Math.cos((t * Math.PI) / 2)),
          angle: 180 - t * 90,
        };
      case 'E': // Turn right into North Outbound (x=330, y=238)
        return {
          x: 362 - 32 * (1 - Math.cos((t * Math.PI) / 2)),
          y: 270 - 32 * Math.sin((t * Math.PI) / 2),
          angle: 90 - t * 90,
        };
      case 'W': // Turn right into South Outbound (x=270, y=362)
        return {
          x: 238 + 32 * (1 - Math.cos((t * Math.PI) / 2)),
          y: 330 + 32 * Math.sin((t * Math.PI) / 2),
          angle: 270 - t * 90,
        };
    }
  }

  // LEFT turn: Smooth sweeping Bézier arc across the center of the intersection
  switch (approach) {
    case 'N': {
      // From (270, 238) to (362, 330)
      const x = 270 + 92 * (t * t);
      const y = 238 + 92 * (2 * t - t * t);
      const angle = (t * 90) % 360;
      return { x, y, angle };
    }
    case 'S': {
      // From (330, 362) to (238, 270)
      const x = 330 - 92 * (t * t);
      const y = 362 - 92 * (2 * t - t * t);
      const angle = 180 + t * 90;
      return { x, y, angle };
    }
    case 'E': {
      // From (362, 270) to (270, 362)
      const x = 362 - 92 * (2 * t - t * t);
      const y = 270 + 92 * (t * t);
      const angle = 90 + t * 90;
      return { x, y, angle };
    }
    case 'W': {
      // From (238, 330) to (330, 238)
      const x = 238 + 92 * (2 * t - t * t);
      const y = 330 - 92 * (t * t);
      const angle = (270 + t * 90) % 360;
      return { x, y, angle };
    }
  }
}

