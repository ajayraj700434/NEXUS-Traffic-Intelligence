import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SafetyValidator, SignalVector } from '../simulation/safetyValidator';
import { AdaptiveController } from '../controllers/AdaptiveController';
import { FixedTimeController } from '../controllers/FixedTimeController';
import { ComparisonRunner } from '../analytics/comparisonEngine';
import { DEFAULT_CONFIG } from '../simulation/scenarios';
import { Approach, SimulationConfig, Vehicle, VehicleType } from '../types';

describe('Strict Single-GREEN-Signal Rule - Comprehensive Safety Verification', () => {
  const mockCar = (
    id: string,
    app: Approach,
    dist: number = 50,
    speed: number = 50,
    waitingTime: number = 0,
    state: Vehicle['state'] = 'approaching'
  ): Vehicle => ({
    id,
    approach: app,
    type: 'car',
    movement: 'STRAIGHT',
    targetApproach: app === 'N' ? 'S' : app === 'S' ? 'N' : app === 'E' ? 'W' : 'E',
    arrivalTime: 0,
    queueEntryTime: null,
    departureTime: null,
    exitTime: null,
    state,
    distance: dist,
    speed,
    waitingTime,
    color: '#38bdf8',
  });

  const getFrontBumperDistanceToStopLinePx = (v: Vehicle): number => {
    const bumperDistance = SimulationEngine.getFrontBumperDistance(v);
    return SimulationEngine.STOP_LINE - bumperDistance;
  };

  // =========================================================================
  // Requirement 1 & 2 & 3: Exactly ONE signal GREEN, other THREE strictly RED
  // =========================================================================
  it('1. Exactly ONE approach receives GREEN at any time, while the other THREE approaches remain strictly RED', () => {
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];

    for (const app of approaches) {
      const phase = `${app}_GREEN` as const;
      const signals = SafetyValidator.getSignalsForPhase(phase);

      // The active approach is GREEN
      expect(signals[app]).toBe('GREEN');

      // The other THREE approaches MUST be RED
      const otherApps = approaches.filter((a) => a !== app);
      for (const other of otherApps) {
        expect(signals[other]).toBe('RED');
      }

      // Exactly 1 GREEN signal total
      const greenCount = approaches.filter((a) => signals[a] === 'GREEN').length;
      expect(greenCount).toBe(1);

      // Exactly 3 RED signals total
      const redCount = approaches.filter((a) => signals[a] === 'RED').length;
      expect(redCount).toBe(3);

      // Validator confirms safety
      const safety = SafetyValidator.validateNoConflictingGreens(signals);
      expect(safety.safe).toBe(true);
    }
  });

  // =========================================================================
  // Requirement 4: Never allow North and South to be GREEN simultaneously
  // =========================================================================
  it('2. Never allows North and South to be GREEN simultaneously (Strictly Forbidden)', () => {
    // Direct violation check
    const northSouthGreen: SignalVector = { N: 'GREEN', S: 'GREEN', E: 'RED', W: 'RED' };
    const result = SafetyValidator.validateNoConflictingGreens(northSouthGreen);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Simultaneous North and South GREEN signals detected');

    // In simulation: N_GREEN strictly leaves South RED
    const signalsN = SafetyValidator.getSignalsForPhase('N_GREEN');
    expect(signalsN.N).toBe('GREEN');
    expect(signalsN.S).toBe('RED');

    // In simulation: S_GREEN strictly leaves North RED
    const signalsS = SafetyValidator.getSignalsForPhase('S_GREEN');
    expect(signalsS.S).toBe('GREEN');
    expect(signalsS.N).toBe('RED');
  });

  // =========================================================================
  // Requirement 5: Never allow East and West to be GREEN simultaneously
  // =========================================================================
  it('3. Never allows East and West to be GREEN simultaneously (Strictly Forbidden)', () => {
    // Direct violation check
    const eastWestGreen: SignalVector = { N: 'RED', S: 'RED', E: 'GREEN', W: 'GREEN' };
    const result = SafetyValidator.validateNoConflictingGreens(eastWestGreen);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Simultaneous East and West GREEN signals detected');

    // In simulation: E_GREEN strictly leaves West RED
    const signalsE = SafetyValidator.getSignalsForPhase('E_GREEN');
    expect(signalsE.E).toBe('GREEN');
    expect(signalsE.W).toBe('RED');

    // In simulation: W_GREEN strictly leaves East RED
    const signalsW = SafetyValidator.getSignalsForPhase('W_GREEN');
    expect(signalsW.W).toBe('GREEN');
    expect(signalsW.E).toBe('RED');
  });

  // =========================================================================
  // Requirement 6: Never allow two or more signals to be GREEN at the same time
  // =========================================================================
  it('4. Never allows two or more signals to be GREEN simultaneously across all approach combinations', () => {
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];

    // Test every pair of approaches
    for (let i = 0; i < approaches.length; i++) {
      for (let j = i + 1; j < approaches.length; j++) {
        const app1 = approaches[i];
        const app2 = approaches[j];

        const vector: SignalVector = {
          N: 'RED',
          S: 'RED',
          E: 'RED',
          W: 'RED',
        };
        vector[app1] = 'GREEN';
        vector[app2] = 'GREEN';

        const result = SafetyValidator.validateNoConflictingGreens(vector);
        expect(result.safe).toBe(false);
      }
    }

    // Test 3 and 4 simultaneous greens
    const allGreen: SignalVector = { N: 'GREEN', S: 'GREEN', E: 'GREEN', W: 'GREEN' };
    expect(SafetyValidator.validateNoConflictingGreens(allGreen).safe).toBe(false);

    const threeGreen: SignalVector = { N: 'GREEN', S: 'GREEN', E: 'GREEN', W: 'RED' };
    expect(SafetyValidator.validateNoConflictingGreens(threeGreen).safe).toBe(false);
  });

  // =========================================================================
  // Full Simulation Invariant: 300s Fixed-Time zero simultaneous greens
  // =========================================================================
  it('5. Fixed-Time controller guarantees at most ONE GREEN signal and THREE RED signals at every step of 300s simulation', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      seed: 1234,
      controllerType: 'FIXED',
      simulationDuration: 300,
    });
    engine.play();

    for (let t = 0.5; t <= 300; t += 0.5) {
      engine.step(0.5);
      const signals = SafetyValidator.getSignalsForPhase(engine.getCurrentPhase());
      const approaches: Approach[] = ['N', 'S', 'E', 'W'];
      const greenCount = approaches.filter((a) => signals[a] === 'GREEN').length;
      const redCount = approaches.filter((a) => signals[a] === 'RED').length;

      // Invariant: at most 1 green
      expect(greenCount).toBeLessThanOrEqual(1);

      // If one is green, exactly 3 must be red
      if (greenCount === 1) {
        expect(redCount).toBe(3);
      }

      // North and South NEVER green simultaneously
      expect(signals.N === 'GREEN' && signals.S === 'GREEN').toBe(false);

      // East and West NEVER green simultaneously
      expect(signals.E === 'GREEN' && signals.W === 'GREEN').toBe(false);

      // Safety validator confirms 0 violations
      expect(SafetyValidator.validateNoConflictingGreens(signals).safe).toBe(true);
    }
  });

  // =========================================================================
  // Full Simulation Invariant: 300s Adaptive AI zero simultaneous greens
  // =========================================================================
  it('6. Adaptive AI controller guarantees at most ONE GREEN signal and THREE RED signals at every step of 300s simulation', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      seed: 5678,
      controllerType: 'ADAPTIVE',
      simulationDuration: 300,
    });
    engine.play();

    for (let t = 0.5; t <= 300; t += 0.5) {
      engine.step(0.5);
      const signals = SafetyValidator.getSignalsForPhase(engine.getCurrentPhase());
      const approaches: Approach[] = ['N', 'S', 'E', 'W'];
      const greenCount = approaches.filter((a) => signals[a] === 'GREEN').length;
      const redCount = approaches.filter((a) => signals[a] === 'RED').length;

      // Invariant: at most 1 green
      expect(greenCount).toBeLessThanOrEqual(1);

      // If one is green, exactly 3 must be red
      if (greenCount === 1) {
        expect(redCount).toBe(3);
      }

      // North and South NEVER green simultaneously
      expect(signals.N === 'GREEN' && signals.S === 'GREEN').toBe(false);

      // East and West NEVER green simultaneously
      expect(signals.E === 'GREEN' && signals.W === 'GREEN').toBe(false);

      // Safety validator confirms 0 violations
      expect(SafetyValidator.validateNoConflictingGreens(signals).safe).toBe(true);
    }
  });

  // =========================================================================
  // Requirement 7: Safe transition GREEN -> YELLOW -> ALL RED -> next GREEN
  // =========================================================================
  it('7. Enforces strict sequential transition: GREEN -> YELLOW -> ALL RED -> next approach GREEN', () => {
    // Direct jumps are forbidden
    expect(SafetyValidator.validatePhaseTransition('N_GREEN', 'S_GREEN').legal).toBe(false);
    expect(SafetyValidator.validatePhaseTransition('N_GREEN', 'ALL_RED').legal).toBe(false);
    expect(SafetyValidator.validatePhaseTransition('N_YELLOW', 'S_GREEN').legal).toBe(false);

    // Legal sequence
    expect(SafetyValidator.validatePhaseTransition('N_GREEN', 'N_YELLOW').legal).toBe(true);
    expect(SafetyValidator.validatePhaseTransition('N_YELLOW', 'ALL_RED').legal).toBe(true);
    expect(SafetyValidator.validatePhaseTransition('ALL_RED', 'S_GREEN').legal).toBe(true);

    // Verify runtime sequence in engine
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      fixedGreenDuration: 10,
      yellowDuration: 3,
      allRedDuration: 1,
      controllerType: 'FIXED',
    });
    engine.play();
    expect(engine.getCurrentPhase()).toBe('N_GREEN');

    // Run through 10s of green -> enters N_YELLOW
    for (let s = 0; s < 20; s++) {
      engine.step(0.5);
    }
    expect(engine.getCurrentPhase()).toBe('N_YELLOW');

    // Run through 3s of yellow -> enters ALL_RED
    for (let s = 0; s < 6; s++) {
      engine.step(0.5);
    }
    expect(engine.getCurrentPhase()).toBe('ALL_RED');

    // All four signals must be RED during ALL_RED
    const allRedSignals = SafetyValidator.getSignalsForPhase(engine.getCurrentPhase());
    expect(allRedSignals.N).toBe('RED');
    expect(allRedSignals.S).toBe('RED');
    expect(allRedSignals.E).toBe('RED');
    expect(allRedSignals.W).toBe('RED');

    // Run through 1s of ALL_RED -> next approach (S_GREEN) activates
    for (let s = 0; s < 2; s++) {
      engine.step(0.5);
    }
    expect(engine.getCurrentPhase()).toBe('S_GREEN');
  });

  // =========================================================================
  // Requirement 8: All vehicles from previous direction clear before next green
  // =========================================================================
  it('8. Ensures all vehicles from previous direction clear the intersection before next approach gets GREEN', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      fixedGreenDuration: 10,
      yellowDuration: 3,
      allRedDuration: 1,
      controllerType: 'FIXED',
      arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
    });
    engine.play();
    (engine as any).currentPhase = 'ALL_RED';
    (engine as any).phaseElapsedTime = 1.0; // 1.0s allRed elapsed

    // North car from previous phase is still clearing inside the intersection box (distance 220)
    const clearingCar = mockCar('n-clear', 'N', 220, 30, 0, 'crossing');
    (engine as any).vehicles.N = [clearingCar];

    // Engine steps: must remain in ALL_RED because vehicle is still clearing
    engine.step(0.5);
    expect(engine.getCurrentPhase()).toBe('ALL_RED');

    // Fast-forward clearing car past intersection exit (distance 280 > INTERSECTION_END 260)
    clearingCar.distance = 280;

    // Next step: intersection is clear, so next phase (S_GREEN) activates
    engine.step(0.5);
    expect(engine.getCurrentPhase()).toBe('S_GREEN');
  });

  // =========================================================================
  // Requirement 9: Front bumper stops 15-20 pixels before stop line on RED/YELLOW
  // =========================================================================
  it('9. Vehicles stop with front bumper approximately 15-20 pixels before stop line across all 4 approaches', () => {
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];
    const types: VehicleType[] = ['car', 'bus', 'truck', 'emergency'];

    for (const app of approaches) {
      for (const type of types) {
        const engine = new SimulationEngine({
          ...DEFAULT_CONFIG,
          arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        });
        engine.play();

        // Approach is held at RED
        const otherGreen = app === 'N' ? 'S_GREEN' : 'N_GREEN';
        (engine as any).currentPhase = otherGreen;
        expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase())[app]).toBe('RED');

        const testVeh: Vehicle = {
          id: `stop-${app}-${type}`,
          approach: app,
          type,
          movement: 'STRAIGHT',
          targetApproach: app === 'N' ? 'S' : app === 'S' ? 'N' : app === 'E' ? 'W' : 'E',
          arrivalTime: 0,
          queueEntryTime: null,
          departureTime: null,
          exitTime: null,
          state: 'approaching',
          distance: 40,
          speed: 50,
          waitingTime: 0,
          color: '#ffffff',
          isEmergency: type === 'emergency',
        };
        (engine as any).vehicles[app] = [testVeh];

        // Step forward until vehicle decelerates to a stop
        for (let s = 0; s < 25; s++) {
          engine.step(0.5);
        }

        expect(testVeh.state).toBe('queued');
        expect(testVeh.speed).toBe(0);

        const pxBeforeStopLine = getFrontBumperDistanceToStopLinePx(testVeh);
        expect(pxBeforeStopLine).toBeGreaterThanOrEqual(15);
        expect(pxBeforeStopLine).toBeLessThanOrEqual(20);
      }
    }
  });

  // =========================================================================
  // Requirement 9b: Zero red light violations across full simulation
  // =========================================================================
  it('10. Zero vehicles cross the stop line during RED or ALL_RED across full simulations (Fixed & Adaptive)', () => {
    const controllers: ('FIXED' | 'ADAPTIVE')[] = ['FIXED', 'ADAPTIVE'];

    for (const ctrl of controllers) {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        seed: 777,
        controllerType: ctrl,
        simulationDuration: 180,
      });
      engine.play();

      for (let t = 0.5; t <= 180; t += 0.5) {
        const signalsBeforeStep = SafetyValidator.getSignalsForPhase(engine.getCurrentPhase());
        const vehiclesBefore = { ...engine.getVehicles() };

        engine.step(0.5);

        for (const app of ['N', 'S', 'E', 'W'] as Approach[]) {
          if (signalsBeforeStep[app] === 'RED') {
            const laneBefore = vehiclesBefore[app] || [];
            for (const v of laneBefore) {
              if (v.distance < SimulationEngine.STOP_LINE) {
                // Front bumper must NEVER cross stop line while signal was RED
                const bumperDist = SimulationEngine.getFrontBumperDistance(v);
                expect(bumperDist).toBeLessThanOrEqual(SimulationEngine.STOP_LINE);
                expect(v.departureTime).toBeNull();
              }
            }
          }
        }
      }
    }
  });

  // =========================================================================
  // Requirement 10: Vehicles move only straight in designated lanes
  // =========================================================================
  it('11. Vehicles move only straight in designated lanes with zero turning or crossing maneuvers', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      seed: 999,
      simulationDuration: 60,
    });
    engine.play();

    for (let t = 0.5; t <= 60; t += 0.5) {
      engine.step(0.5);
    }

    const allVehicles = engine.getVehicles();
    for (const app of ['N', 'S', 'E', 'W'] as Approach[]) {
      for (const v of allVehicles[app]) {
        expect(v.movement).toBe('STRAIGHT');
      }
    }
  });

  // =========================================================================
  // Adaptive AI Controller: Evaluates single approaches & selects highest demand
  // =========================================================================
  it('12. Adaptive AI controller evaluates all 4 individual approaches and selects single highest-pressure approach', () => {
    const adaptive = new AdaptiveController();
    const config = { ...DEFAULT_CONFIG };

    // South approach has highest queue demand (8 vehicles)
    const context = {
      currentTime: 30,
      currentApproach: null,
      phaseElapsedTime: 10,
      queues: {
        N: Array.from({ length: 3 }, (_, i) => mockCar(`n${i}`, 'N', 10, 0, 10, 'queued')),
        S: Array.from({ length: 8 }, (_, i) => mockCar(`s${i}`, 'S', 10, 0, 15, 'queued')),
        E: Array.from({ length: 2 }, (_, i) => mockCar(`e${i}`, 'E', 5, 0, 5, 'queued')),
        W: Array.from({ length: 1 }, (_, i) => mockCar(`w${i}`, 'W', 5, 0, 5, 'queued')),
      },
      arrivalRates: config.arrivalRates,
      config,
    };

    const decision = adaptive.selectNextPhase(context);
    expect(decision.selectedApproach).toBe('S');
    expect(decision.scores.S.queueCount).toBe(8);
    expect(decision.scores.S.rawScore).toBeGreaterThan(decision.scores.N.rawScore);
    expect(decision.scores.S.rawScore).toBeGreaterThan(decision.scores.E.rawScore);
    expect(decision.scores.S.rawScore).toBeGreaterThan(decision.scores.W.rawScore);
  });

  // =========================================================================
  // Starvation Prevention: Single starving approach is prioritized
  // =========================================================================
  it('13. Starvation prevention prioritizes a single starving approach over higher raw volume', () => {
    const adaptive = new AdaptiveController();
    const config = { ...DEFAULT_CONFIG, starvationThreshold: 45 };

    // North has 10 vehicles waiting 10s
    // West has only 1 vehicle waiting 60s (> 45s starvation threshold)
    const context = {
      currentTime: 100,
      currentApproach: 'N' as const,
      phaseElapsedTime: 20,
      queues: {
        N: Array.from({ length: 10 }, (_, i) => mockCar(`n${i}`, 'N', 10, 0, 10, 'queued')),
        S: [],
        E: [],
        W: [mockCar('w-starving', 'W', 10, 0, 60, 'queued')],
      },
      arrivalRates: config.arrivalRates,
      config,
    };

    const decision = adaptive.selectNextPhase(context);
    expect(decision.selectedApproach).toBe('W');
    expect(decision.starvationOverride).toBe(true);
    expect(decision.scores.W.isStarving).toBe(true);
    expect(decision.rationale).toContain('STARVATION OVERRIDE');
  });

  // =========================================================================
  // ComparisonRunner Benchmark
  // =========================================================================
  it('14. ComparisonRunner benchmarks Fixed-Time and Adaptive AI under single-green rule with valid metrics and timeline', () => {
    const testConfig: SimulationConfig = {
      ...DEFAULT_CONFIG,
      seed: 101,
      simulationDuration: 120,
    };

    const report = ComparisonRunner.runExperiment(testConfig, 'Single-Green Validation');

    expect(report.fixed).toBeDefined();
    expect(report.adaptive).toBeDefined();
    expect(report.fixed.totalServed).toBeGreaterThan(0);
    expect(report.adaptive.totalServed).toBeGreaterThan(0);
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(typeof report.deltas.avgWaitPercent).toBe('number');
    expect(typeof report.deltas.throughputPercent).toBe('number');
    expect(report.interpretation).toBeTruthy();
    expect(report.interpretation.length).toBeGreaterThan(20);
  });
});
