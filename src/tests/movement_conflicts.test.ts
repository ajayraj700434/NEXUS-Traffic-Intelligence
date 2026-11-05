import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../simulation/SimulationEngine';
import {
  ALL_MOVEMENTS,
  areMovementsConflicting,
  calculateVehicleCoordinates,
  getMovementKey,
  getTargetApproach,
  isMovementPermittedInPhase,
  MOVEMENT_CONFLICT_MATRIX,
} from '../simulation/movementConflicts';
import { Approach, MovementKey, MovementType, PhaseType, Vehicle } from '../types';
import { DEFAULT_CONFIG } from '../simulation/scenarios';

describe('Movement-Level Collision Safety & Conflict Matrix Suite', () => {
  const createMockVehicle = (
    id: string,
    approach: Approach,
    movement: MovementType = 'STRAIGHT',
    distance: number = 50,
    speed: number = 50,
    state: Vehicle['state'] = 'approaching'
  ): Vehicle => ({
    id,
    approach,
    type: 'car',
    movement,
    targetApproach: getTargetApproach(approach, movement),
    arrivalTime: 0,
    queueEntryTime: null,
    departureTime: null,
    exitTime: null,
    state,
    distance,
    speed,
    waitingTime: 0,
    color: '#38bdf8',
  });

  // =========================================================================
  // 1. Explicit Movement Definitions & Topologies
  // =========================================================================
  describe('1. Movement Definitions & Trajectory Mapping', () => {
    it('defines exactly 12 movements across the 4 approaches (3 per approach)', () => {
      expect(ALL_MOVEMENTS).toHaveLength(12);
      const expectedMovements: MovementKey[] = [
        'N_STRAIGHT', 'N_LEFT', 'N_RIGHT',
        'S_STRAIGHT', 'S_LEFT', 'S_RIGHT',
        'E_STRAIGHT', 'E_LEFT', 'E_RIGHT',
        'W_STRAIGHT', 'W_LEFT', 'W_RIGHT',
      ];
      for (const m of expectedMovements) {
        expect(ALL_MOVEMENTS).toContain(m);
      }
    });

    it('correctly maps each inbound approach and movement to its physical target outbound approach', () => {
      // North
      expect(getTargetApproach('N', 'STRAIGHT')).toBe('S');
      expect(getTargetApproach('N', 'LEFT')).toBe('E');
      expect(getTargetApproach('N', 'RIGHT')).toBe('W');

      // South
      expect(getTargetApproach('S', 'STRAIGHT')).toBe('N');
      expect(getTargetApproach('S', 'LEFT')).toBe('W');
      expect(getTargetApproach('S', 'RIGHT')).toBe('E');

      // East
      expect(getTargetApproach('E', 'STRAIGHT')).toBe('W');
      expect(getTargetApproach('E', 'LEFT')).toBe('S');
      expect(getTargetApproach('E', 'RIGHT')).toBe('N');

      // West
      expect(getTargetApproach('W', 'STRAIGHT')).toBe('E');
      expect(getTargetApproach('W', 'LEFT')).toBe('N');
      expect(getTargetApproach('W', 'RIGHT')).toBe('S');
    });

    it('computes continuous coordinates for all 12 movements across inbound, traversal, and departure', () => {
      for (const mKey of ALL_MOVEMENTS) {
        const [app, mType] = mKey.split('_') as [Approach, MovementType];

        // Inbound point (distance = 100)
        const inPt = calculateVehicleCoordinates(app, mType, 100);
        expect(inPt.x).toBeGreaterThanOrEqual(0);
        expect(inPt.x).toBeLessThanOrEqual(600);
        expect(inPt.y).toBeGreaterThanOrEqual(0);
        expect(inPt.y).toBeLessThanOrEqual(600);

        // Mid-intersection traversal point (distance = 220)
        const midPt = calculateVehicleCoordinates(app, mType, 220);
        expect(midPt.x).toBeGreaterThanOrEqual(230);
        expect(midPt.x).toBeLessThanOrEqual(370);
        expect(midPt.y).toBeGreaterThanOrEqual(230);
        expect(midPt.y).toBeLessThanOrEqual(370);

        // Outbound departure point (distance = 320)
        const outPt = calculateVehicleCoordinates(app, mType, 320);
        expect(outPt.x).toBeGreaterThanOrEqual(0);
        expect(outPt.x).toBeLessThanOrEqual(600);
        expect(outPt.y).toBeGreaterThanOrEqual(0);
        expect(outPt.y).toBeLessThanOrEqual(600);
      }
    });
  });

  // =========================================================================
  // 2. Conflict Matrix Symmetry & Invariant Testing
  // =========================================================================
  describe('2. Movement Conflict Matrix Properties', () => {
    it('is an exact 12x12 matrix with symmetric conflict relationships', () => {
      for (const m1 of ALL_MOVEMENTS) {
        expect(MOVEMENT_CONFLICT_MATRIX[m1]).toBeDefined();
        for (const m2 of ALL_MOVEMENTS) {
          const c1 = MOVEMENT_CONFLICT_MATRIX[m1][m2];
          const c2 = MOVEMENT_CONFLICT_MATRIX[m2][m1];
          expect(c1).toBe(c2); // Symmetry invariant
          expect(typeof c1).toBe('boolean');
        }
      }
    });

    it('identifies diagonal entries (same movement on same approach) as non-conflicting single file', () => {
      for (const m of ALL_MOVEMENTS) {
        expect(areMovementsConflicting(m, m)).toBe(false);
      }
    });

    it('verifies non-conflicting parallel straight flows with 60px physical lateral separation', () => {
      expect(areMovementsConflicting('N_STRAIGHT', 'S_STRAIGHT')).toBe(false);
      expect(areMovementsConflicting('S_STRAIGHT', 'N_STRAIGHT')).toBe(false);
      expect(areMovementsConflicting('E_STRAIGHT', 'W_STRAIGHT')).toBe(false);
      expect(areMovementsConflicting('W_STRAIGHT', 'E_STRAIGHT')).toBe(false);

      // Verify physical coordinates have lateral separation
      const nMid = calculateVehicleCoordinates('N', 'STRAIGHT', 220);
      const sMid = calculateVehicleCoordinates('S', 'STRAIGHT', 220);
      expect(Math.abs(sMid.x - nMid.x)).toBe(60); // 60px lateral lane offset
    });

    it('verifies non-conflicting dual protected left-turn pairs', () => {
      // Dual left turns turn in front of each other on opposite sides of intersection center (300, 300)
      expect(areMovementsConflicting('N_LEFT', 'S_LEFT')).toBe(false);
      expect(areMovementsConflicting('S_LEFT', 'N_LEFT')).toBe(false);
      expect(areMovementsConflicting('E_LEFT', 'W_LEFT')).toBe(false);
      expect(areMovementsConflicting('W_LEFT', 'E_LEFT')).toBe(false);
    });

    it('verifies non-conflicting right turns in disjoint quadrants', () => {
      expect(areMovementsConflicting('N_RIGHT', 'S_RIGHT')).toBe(false);
      expect(areMovementsConflicting('N_RIGHT', 'E_RIGHT')).toBe(false);
      expect(areMovementsConflicting('S_RIGHT', 'W_RIGHT')).toBe(false);
      expect(areMovementsConflicting('E_RIGHT', 'W_RIGHT')).toBe(false);
    });

    it('verifies conflicting opposing straight vs left-turn pairs', () => {
      // Opposing left turns cross opposing straight traffic
      expect(areMovementsConflicting('N_STRAIGHT', 'S_LEFT')).toBe(true);
      expect(areMovementsConflicting('S_STRAIGHT', 'N_LEFT')).toBe(true);
      expect(areMovementsConflicting('E_STRAIGHT', 'W_LEFT')).toBe(true);
      expect(areMovementsConflicting('W_STRAIGHT', 'E_LEFT')).toBe(true);
    });

    it('verifies conflicting orthogonal straight flows', () => {
      expect(areMovementsConflicting('N_STRAIGHT', 'E_STRAIGHT')).toBe(true);
      expect(areMovementsConflicting('N_STRAIGHT', 'W_STRAIGHT')).toBe(true);
      expect(areMovementsConflicting('S_STRAIGHT', 'E_STRAIGHT')).toBe(true);
      expect(areMovementsConflicting('S_STRAIGHT', 'W_STRAIGHT')).toBe(true);
    });

    it('verifies merge conflicts into the same outbound lane', () => {
      // N_RIGHT and S_LEFT both exit into West outbound lane
      expect(areMovementsConflicting('N_RIGHT', 'S_LEFT')).toBe(true);
      // S_RIGHT and N_LEFT both exit into East outbound lane
      expect(areMovementsConflicting('S_RIGHT', 'N_LEFT')).toBe(true);
      // E_RIGHT and W_LEFT both exit into North outbound lane
      expect(areMovementsConflicting('E_RIGHT', 'W_LEFT')).toBe(true);
      // W_RIGHT and E_LEFT both exit into South outbound lane
      expect(areMovementsConflicting('W_RIGHT', 'E_LEFT')).toBe(true);
    });
  });

  // =========================================================================
  // 3. Signal Phase Permissions for Movements
  // =========================================================================
  describe('3. Signal Phase Permission Rules', () => {
    it('grants permission only to non-conflicting movements in NS_GREEN', () => {
      // Permitted: N_STRAIGHT, N_RIGHT, S_STRAIGHT, S_RIGHT
      expect(isMovementPermittedInPhase('N', 'STRAIGHT', 'NS_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('N', 'RIGHT', 'NS_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('S', 'STRAIGHT', 'NS_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('S', 'RIGHT', 'NS_GREEN')).toBe(true);

      // Forbidden: Left turns on N and S are held at RED to protect opposing straight
      expect(isMovementPermittedInPhase('N', 'LEFT', 'NS_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('S', 'LEFT', 'NS_GREEN')).toBe(false);

      // Forbidden: All East-West movements
      for (const m of ['STRAIGHT', 'LEFT', 'RIGHT'] as MovementType[]) {
        expect(isMovementPermittedInPhase('E', m, 'NS_GREEN')).toBe(false);
        expect(isMovementPermittedInPhase('W', m, 'NS_GREEN')).toBe(false);
      }
    });

    it('grants permission strictly to protected left turns in NS_LEFT_GREEN', () => {
      // Permitted: N_LEFT, S_LEFT
      expect(isMovementPermittedInPhase('N', 'LEFT', 'NS_LEFT_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('S', 'LEFT', 'NS_LEFT_GREEN')).toBe(true);

      // Forbidden: Straight and right turns
      expect(isMovementPermittedInPhase('N', 'STRAIGHT', 'NS_LEFT_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('N', 'RIGHT', 'NS_LEFT_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('S', 'STRAIGHT', 'NS_LEFT_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('S', 'RIGHT', 'NS_LEFT_GREEN')).toBe(false);

      // Forbidden: All East-West movements
      for (const m of ['STRAIGHT', 'LEFT', 'RIGHT'] as MovementType[]) {
        expect(isMovementPermittedInPhase('E', m, 'NS_LEFT_GREEN')).toBe(false);
        expect(isMovementPermittedInPhase('W', m, 'NS_LEFT_GREEN')).toBe(false);
      }
    });

    it('grants permission only to non-conflicting movements in EW_GREEN', () => {
      expect(isMovementPermittedInPhase('E', 'STRAIGHT', 'EW_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('E', 'RIGHT', 'EW_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('W', 'STRAIGHT', 'EW_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('W', 'RIGHT', 'EW_GREEN')).toBe(true);

      // Left turns held at red
      expect(isMovementPermittedInPhase('E', 'LEFT', 'EW_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('W', 'LEFT', 'EW_GREEN')).toBe(false);

      // North-South held at red
      for (const m of ['STRAIGHT', 'LEFT', 'RIGHT'] as MovementType[]) {
        expect(isMovementPermittedInPhase('N', m, 'EW_GREEN')).toBe(false);
        expect(isMovementPermittedInPhase('S', m, 'EW_GREEN')).toBe(false);
      }
    });

    it('grants permission strictly to protected left turns in EW_LEFT_GREEN', () => {
      expect(isMovementPermittedInPhase('E', 'LEFT', 'EW_LEFT_GREEN')).toBe(true);
      expect(isMovementPermittedInPhase('W', 'LEFT', 'EW_LEFT_GREEN')).toBe(true);

      expect(isMovementPermittedInPhase('E', 'STRAIGHT', 'EW_LEFT_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('E', 'RIGHT', 'EW_LEFT_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('W', 'STRAIGHT', 'EW_LEFT_GREEN')).toBe(false);
      expect(isMovementPermittedInPhase('W', 'RIGHT', 'EW_LEFT_GREEN')).toBe(false);
    });

    it('prohibits all entry movements during clearance intervals (YELLOW and ALL_RED)', () => {
      const clearancePhases: PhaseType[] = [
        'ALL_RED',
        'NS_YELLOW',
        'NS_LEFT_YELLOW',
        'EW_YELLOW',
        'EW_LEFT_YELLOW',
      ];

      for (const phase of clearancePhases) {
        for (const app of ['N', 'S', 'E', 'W'] as Approach[]) {
          for (const m of ['STRAIGHT', 'LEFT', 'RIGHT'] as MovementType[]) {
            expect(isMovementPermittedInPhase(app, m, phase)).toBe(false);
          }
        }
      }
    });
  });

  // =========================================================================
  // 4. Dynamic Collision Prevention & Pre-Entry Stopping Physics
  // =========================================================================
  describe('4. Dynamic Intersection Entry Physics & Pre-Entry Clearance', () => {
    it('holds an opposing left-turning vehicle before the stop line while straight traffic traverses', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
        fixedGreenDuration: 25,
      });
      engine.play();

      // Set phase to NS_GREEN
      (engine as any).currentPhase = 'NS_GREEN';

      // Vehicle 1: North Straight vehicle traversing inside intersection (dist: 210)
      const nStraight = createMockVehicle('v1-n', 'N', 'STRAIGHT', 210, 50, 'crossing');
      // Vehicle 2: South Left-turn vehicle approaching stop line (dist: 160)
      const sLeft = createMockVehicle('v2-s', 'S', 'LEFT', 160, 40, 'approaching');

      (engine as any).vehicles.N = [nStraight];
      (engine as any).vehicles.S = [sLeft];

      // Step simulation for 10 steps (5 seconds)
      for (let s = 0; s < 10; s++) {
        engine.step(0.5);
      }

      // S_LEFT vehicle must NOT have entered the intersection!
      expect(sLeft.distance).toBeLessThan(SimulationEngine.STOP_LINE);
      expect(sLeft.state).toBe('queued');
      expect(sLeft.speed).toBe(0);
      expect(sLeft.departureTime).toBeNull();

      // Front bumper must be stopped 15-20px before stop line
      const bumperDist = SimulationEngine.getFrontBumperDistance(sLeft);
      expect(bumperDist).toBeLessThanOrEqual(SimulationEngine.STOP_LINE);
    });

    it('holds a merge-conflicting vehicle before the stop line (N_RIGHT and S_LEFT both heading to West)', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
        fixedGreenDuration: 25,
      });
      engine.play();

      // N_RIGHT vehicle currently executing its corner turn in intersection
      const nRight = createMockVehicle('v-n-right', 'N', 'RIGHT', 210, 45, 'crossing');
      // S_LEFT vehicle approaching stop line
      const sLeft = createMockVehicle('v-s-left', 'S', 'LEFT', 165, 40, 'approaching');

      (engine as any).vehicles.N = [nRight];
      (engine as any).vehicles.S = [sLeft];

      for (let s = 0; s < 8; s++) {
        engine.step(0.5);
      }

      // S_LEFT must be held before stop line because N_RIGHT is occupying the conflicting merge path
      expect(sLeft.distance).toBeLessThan(SimulationEngine.STOP_LINE);
      expect(sLeft.departureTime).toBeNull();
    });

    it('enforces single-approach green: North vehicle enters while opposing South is held strictly behind stop line at RED', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
        fixedGreenDuration: 25,
      });
      engine.play();
      (engine as any).currentPhase = 'N_GREEN';

      const nStraight = createMockVehicle('n-st', 'N', 'STRAIGHT', 170, 40, 'approaching');
      const sStraight = createMockVehicle('s-st', 'S', 'STRAIGHT', 170, 40, 'approaching');

      (engine as any).vehicles.N = [nStraight];
      (engine as any).vehicles.S = [sStraight];

      // Step simulation
      for (let s = 0; s < 4; s++) {
        engine.step(0.5);
      }

      // North vehicle successfully enters and crosses (signal is GREEN)
      expect(nStraight.distance).toBeGreaterThan(SimulationEngine.STOP_LINE);
      expect(nStraight.state).toBe('crossing');
      expect(nStraight.departureTime).not.toBeNull();

      // STRICT INVARIANT: Opposing South approach remains RED; South vehicle CANNOT enter
      expect(sStraight.distance).toBeLessThan(SimulationEngine.STOP_LINE);
      expect(sStraight.state).not.toBe('crossing');
    });

    it('prevents simultaneous entry across opposing approaches: holds opposing vehicle at RED before stop line', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
        fixedGreenDuration: 25,
      });
      engine.play();
      (engine as any).currentPhase = 'N_GREEN';

      const nVehicle = createMockVehicle('n-lf', 'N', 'STRAIGHT', 170, 40, 'approaching');
      const sVehicle = createMockVehicle('s-lf', 'S', 'STRAIGHT', 170, 40, 'approaching');

      (engine as any).vehicles.N = [nVehicle];
      (engine as any).vehicles.S = [sVehicle];

      for (let s = 0; s < 4; s++) {
        engine.step(0.5);
      }

      // North crosses, South remains strictly stationary behind stop line
      expect(nVehicle.distance).toBeGreaterThan(SimulationEngine.STOP_LINE);
      expect(nVehicle.state).toBe('crossing');
      expect(sVehicle.distance).toBeLessThan(SimulationEngine.STOP_LINE);
    });

    it('holds straight vehicles at stop line during protected left-turn phase (NS_LEFT_GREEN)', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
        fixedGreenDuration: 25,
      });
      engine.play();
      (engine as any).currentPhase = 'NS_LEFT_GREEN';

      const nStraight = createMockVehicle('n-straight-held', 'N', 'STRAIGHT', 160, 40, 'approaching');
      (engine as any).vehicles.N = [nStraight];

      for (let s = 0; s < 10; s++) {
        engine.step(0.5);
      }

      // Straight vehicle must stop at stop line during left-turn green
      expect(nStraight.distance).toBeLessThan(SimulationEngine.STOP_LINE);
      expect(nStraight.state).toBe('queued');
      expect(nStraight.speed).toBe(0);
      expect(nStraight.departureTime).toBeNull();
    });
  });

  // =========================================================================
  // 5. Exhaustive Automated Collision Safety Sweep Across All Conflicting Pairs
  // =========================================================================
  describe('5. Exhaustive Collision Verification Across All Conflicting Pairs', () => {
    it('verifies that no two conflicting movements can occupy the intersection simultaneously', () => {
      let testedConflictingPairsCount = 0;

      for (const m1 of ALL_MOVEMENTS) {
        for (const m2 of ALL_MOVEMENTS) {
          if (!areMovementsConflicting(m1, m2)) continue;

          testedConflictingPairsCount++;
          const [app1, type1] = m1.split('_') as [Approach, MovementType];
          const [app2, type2] = m2.split('_') as [Approach, MovementType];

          const engine = new SimulationEngine({
            ...DEFAULT_CONFIG,
            arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
            controllerType: 'FIXED',
          });
          engine.play();

          // Vehicle 1 is crossing inside the intersection
          const v1 = createMockVehicle(`v1-${m1}`, app1, type1, 210, 40, 'crossing');
          // Vehicle 2 is approaching the stop line
          const v2 = createMockVehicle(`v2-${m2}`, app2, type2, 160, 40, 'approaching');

          (engine as any).vehicles[app1] = [v1];
          (engine as any).vehicles[app2] = app1 === app2 ? [v1, v2] : [v2];

          // Set phase to green for v2's movement to test dynamic pre-entry conflict hold
          if (type2 === 'LEFT') {
            (engine as any).currentPhase = (app2 === 'N' || app2 === 'S') ? 'NS_LEFT_GREEN' : 'EW_LEFT_GREEN';
          } else {
            (engine as any).currentPhase = (app2 === 'N' || app2 === 'S') ? 'NS_GREEN' : 'EW_GREEN';
          }

          // Step 1 physics tick (0.5s)
          engine.step(0.5);

          // Invariant: v2 CANNOT enter the intersection while conflicting v1 is inside it!
          const v2Entered = v2.distance >= SimulationEngine.STOP_LINE;
          expect(v2Entered).toBe(false);
          expect(v2.distance).toBeLessThan(SimulationEngine.STOP_LINE);
        }
      }

      // Ensure that a non-trivial number of conflicting pairs were tested
      expect(testedConflictingPairsCount).toBeGreaterThan(50);
    });
  });
});

