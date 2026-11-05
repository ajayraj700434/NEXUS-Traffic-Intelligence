import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyValidator, SignalVector } from '../simulation/safetyValidator';
import { SeededPRNG } from '../simulation/prng';
import { TrafficGenerator } from '../simulation/trafficGenerator';
import { FixedTimeController } from '../controllers/FixedTimeController';
import { AdaptiveController } from '../controllers/AdaptiveController';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { ComparisonRunner } from '../analytics/comparisonEngine';
import { DEFAULT_CONFIG, SCENARIO_PRESETS } from '../simulation/scenarios';
import { SimulationConfig, Vehicle } from '../types';

describe('Signal Safety & State Machine Tests', () => {
  it('prevents simultaneous conflicting green signals', () => {
    // Single green is safe
    const safeSignals: SignalVector = { N: 'GREEN', S: 'RED', E: 'RED', W: 'RED' };
    expect(SafetyValidator.validateNoConflictingGreens(safeSignals).safe).toBe(true);

    // Conflicting orthogonal greens are illegal
    const unsafeSignals: SignalVector = { N: 'GREEN', S: 'RED', E: 'GREEN', W: 'RED' };
    const result = SafetyValidator.validateNoConflictingGreens(unsafeSignals);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('CRITICAL SAFETY VIOLATION');
  });

  it('prevents simultaneous green and yellow signals', () => {
    const dangerousSignals: SignalVector = { N: 'GREEN', S: 'RED', E: 'YELLOW', W: 'RED' };
    const result = SafetyValidator.validateNoConflictingGreens(dangerousSignals);
    expect(result.safe).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('simultaneous green');
  });

  it('strictly validates legal phase transition sequences', () => {
    // Green -> Yellow is legal
    expect(SafetyValidator.validatePhaseTransition('N_GREEN', 'N_YELLOW').legal).toBe(true);

    // Green -> All-Red directly is illegal (must clear through yellow)
    expect(SafetyValidator.validatePhaseTransition('N_GREEN', 'ALL_RED').legal).toBe(false);

    // Green -> Another Green directly is illegal
    expect(SafetyValidator.validatePhaseTransition('N_GREEN', 'E_GREEN').legal).toBe(false);

    // Yellow -> All-Red is legal
    expect(SafetyValidator.validatePhaseTransition('N_YELLOW', 'ALL_RED').legal).toBe(true);

    // Yellow -> Green directly is illegal
    expect(SafetyValidator.validatePhaseTransition('N_YELLOW', 'E_GREEN').legal).toBe(false);

    // All-Red -> Any Green is legal
    expect(SafetyValidator.validatePhaseTransition('ALL_RED', 'S_GREEN').legal).toBe(true);
  });
});

describe('Seeded PRNG & Deterministic Traffic Generation', () => {
  it('generates identical pseudo-random sequences for identical seeds', () => {
    const prng1 = new SeededPRNG(42);
    const prng2 = new SeededPRNG(42);

    for (let i = 0; i < 20; i++) {
      expect(prng1.next()).toBe(prng2.next());
    }
  });

  it('generates divergent sequences for different seeds', () => {
    const prngA = new SeededPRNG(100);
    const prngB = new SeededPRNG(200);

    let identical = true;
    for (let i = 0; i < 10; i++) {
      if (prngA.next() !== prngB.next()) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(false);
  });

  it('produces deterministic vehicle arrival sequences with TrafficGenerator', () => {
    const gen1 = new TrafficGenerator(12345);
    const gen2 = new TrafficGenerator(12345);

    const rates = { N: 20, S: 20, E: 10, W: 10 };
    const arrivals1 = gen1.generateStep(1.0, 10.0, rates);
    const arrivals2 = gen2.generateStep(1.0, 10.0, rates);

    expect(arrivals1.length).toBe(arrivals2.length);
    for (let i = 0; i < arrivals1.length; i++) {
      expect(arrivals1[i].id).toBe(arrivals2[i].id);
      expect(arrivals1[i].approach).toBe(arrivals2[i].approach);
      expect(arrivals1[i].type).toBe(arrivals2[i].type);
    }
  });
});

describe('Controller Decision Policies', () => {
  let config: SimulationConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
  });

  it('FixedTimeController cycles sequentially through single-approach phases (N -> S -> E -> W)', () => {
    const fixed = new FixedTimeController(0);
    const contextBase = {
      currentTime: 10,
      currentApproach: null,
      phaseElapsedTime: 25,
      queues: { N: [], S: [], E: [], W: [] },
      arrivalRates: config.arrivalRates,
      config,
    };

    const d1 = fixed.selectNextPhase(contextBase);
    expect(d1.selectedApproach).toBe('N');
    expect(d1.allocatedDuration).toBe(config.fixedGreenDuration);

    const d2 = fixed.selectNextPhase({ ...contextBase, currentApproach: 'N' });
    expect(d2.selectedApproach).toBe('S');

    const d3 = fixed.selectNextPhase({ ...contextBase, currentApproach: 'S' });
    expect(d3.selectedApproach).toBe('E');

    const d4 = fixed.selectNextPhase({ ...contextBase, currentApproach: 'E' });
    expect(d4.selectedApproach).toBe('W');
  });

  it('AdaptiveController prioritizes the approach with highest queue pressure', () => {
    const adaptive = new AdaptiveController();

    const mockVehicle = (id: string, app: 'N' | 'S' | 'E' | 'W', wait: number): Vehicle => ({
      id,
      approach: app,
      type: 'car',
      arrivalTime: 0,
      queueEntryTime: 0,
      departureTime: null,
      exitTime: null,
      state: 'queued',
      distance: 180,
      speed: 0,
      waitingTime: wait,
      color: '#fff',
    });

    // North has 1 vehicle waiting 5s
    // South has 10 vehicles waiting 25s
    // East and West empty
    const context = {
      currentTime: 30,
      currentApproach: null,
      phaseElapsedTime: 15,
      queues: {
        N: [mockVehicle('v1', 'N', 5)],
        S: Array.from({ length: 10 }, (_, i) => mockVehicle(`vs${i}`, 'S', 25)),
        E: [],
        W: [],
      },
      arrivalRates: config.arrivalRates,
      config,
    };

    const decision = adaptive.selectNextPhase(context);
    expect(decision.selectedApproach).toBe('S');
    expect(decision.allocatedDuration).toBeGreaterThanOrEqual(config.adaptiveMinGreen);
    expect(decision.allocatedDuration).toBeLessThanOrEqual(config.adaptiveMaxGreen);
    expect(decision.rationale).toContain('[S]');
  });

  it('AdaptiveController triggers starvation preemption when vehicle exceeds threshold', () => {
    const adaptive = new AdaptiveController();
    config.starvationThreshold = 40;

    const mockVehicle = (id: string, app: 'N' | 'S' | 'E' | 'W', wait: number): Vehicle => ({
      id,
      approach: app,
      type: 'car',
      arrivalTime: 0,
      queueEntryTime: 0,
      departureTime: null,
      exitTime: null,
      state: 'queued',
      distance: 180,
      speed: 0,
      waitingTime: wait,
      color: '#fff',
    });

    // West has only 1 vehicle, but waiting 55s (> 40s starvation threshold)
    // North has 8 vehicles waiting 10s
    const context = {
      currentTime: 60,
      currentApproach: 'N' as const,
      phaseElapsedTime: 20,
      queues: {
        N: Array.from({ length: 8 }, (_, i) => mockVehicle(`vn${i}`, 'N', 10)),
        S: [],
        E: [],
        W: [mockVehicle('vw1', 'W', 55)],
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

  it('AdaptiveController clamps green duration strictly within [minGreen, maxGreen]', () => {
    const adaptive = new AdaptiveController();
    config.adaptiveMinGreen = 10;
    config.adaptiveMaxGreen = 45;

    const mockVehicle = (id: string): Vehicle => ({
      id,
      approach: 'N',
      type: 'car',
      arrivalTime: 0,
      queueEntryTime: 0,
      departureTime: null,
      exitTime: null,
      state: 'queued',
      distance: 180,
      speed: 0,
      waitingTime: 10,
      color: '#fff',
    });

    // Massive queue of 50 vehicles
    const context = {
      currentTime: 20,
      currentApproach: null,
      phaseElapsedTime: 0,
      queues: {
        N: Array.from({ length: 50 }, (_, i) => mockVehicle(`v${i}`)),
        S: [],
        E: [],
        W: [],
      },
      arrivalRates: config.arrivalRates,
      config,
    };

    const decision = adaptive.selectNextPhase(context);
    expect(decision.allocatedDuration).toBe(config.adaptiveMaxGreen);
  });
});

describe('Simulation Engine Lifecycle & State Controls', () => {
  it('runs simulation steps, updates physics, and enforces queue limits', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      seed: 999,
      simulationDuration: 60,
    });

    expect(engine.getCurrentTime()).toBe(0);
    expect(engine.getIsRunning()).toBe(false);

    engine.play();
    expect(engine.getIsRunning()).toBe(true);

    // Step forward 20 seconds (40 half-second ticks)
    for (let i = 0; i < 40; i++) {
      engine.step(0.5);
    }

    expect(engine.getCurrentTime()).toBe(20);
    const metrics = engine.getMetrics();
    expect(metrics.totalGenerated).toBeGreaterThanOrEqual(1);

    // Test pause
    engine.pause();
    expect(engine.getIsRunning()).toBe(false);

    // Test reset
    engine.reset(42);
    expect(engine.getCurrentTime()).toBe(0);
    expect(engine.getMetrics().totalGenerated).toBe(0);
    expect(engine.getMetrics().totalServed).toBe(0);
  });
});

describe('Comparison Runner', () => {
  it('executes side-by-side benchmark with identical vehicle inputs', () => {
    const testConfig: SimulationConfig = {
      ...DEFAULT_CONFIG,
      seed: 42,
      simulationDuration: 30, // 30s benchmark
    };

    const report = ComparisonRunner.runExperiment(testConfig, 'Test Benchmark');

    expect(report.seed).toBe(42);
    expect(report.horizon).toBe(30);
    expect(report.fixed).toBeDefined();
    expect(report.adaptive).toBeDefined();
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(report.interpretation).toBeTruthy();
  });

  it('verifies morning rush metrics benchmark values', () => {
    const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
    const testConfig: SimulationConfig = {
      ...DEFAULT_CONFIG,
      ...preset.config,
      simulationDuration: 300,
    };
    const report = ComparisonRunner.runExperiment(testConfig, preset.name);
    expect(report.fixed.avgWaitingTime).toBe(54.7);
    expect(report.adaptive.avgWaitingTime).toBe(28.3);
    expect(report.fixed.totalServed).toBe(244);
    expect(report.adaptive.totalServed).toBe(293);
    expect(report.fixed.remainingQueue).toBe(106);
    expect(report.adaptive.remainingQueue).toBe(52);
    expect(report.deltas.throughputPercent).toBe(20.1);
  });
});

describe('Emergency Vehicle Preemption', () => {
  it('instantly elevates score and preempts normal queue for emergency response vehicle', () => {
    const adaptive = new AdaptiveController();
    const config = { ...DEFAULT_CONFIG, emergencyPriorityBoost: 1000 };

    const mockCar: Vehicle = {
      id: 'car-1',
      approach: 'N',
      type: 'car',
      arrivalTime: 0,
      queueEntryTime: 0,
      departureTime: null,
      exitTime: null,
      state: 'queued',
      distance: 180,
      speed: 0,
      waitingTime: 15,
      color: '#fff',
      isEmergency: false,
    };

    const emergencyAmbulance: Vehicle = {
      id: 'amb-1',
      approach: 'E',
      type: 'emergency',
      arrivalTime: 0,
      queueEntryTime: 0,
      departureTime: null,
      exitTime: null,
      state: 'queued',
      distance: 180,
      speed: 0,
      waitingTime: 2,
      color: '#ef4444',
      isEmergency: true,
    };

    // North has 12 cars waiting 15s
    // East has only 1 vehicle, but it is an EMERGENCY vehicle waiting only 2s!
    const context = {
      currentTime: 20,
      currentApproach: 'N' as const,
      phaseElapsedTime: 15,
      queues: {
        N: Array.from({ length: 12 }, (_, i) => ({ ...mockCar, id: `c-${i}` })),
        S: [],
        E: [emergencyAmbulance],
        W: [],
      },
      arrivalRates: config.arrivalRates,
      config,
    };

    const decision = adaptive.selectNextPhase(context);
    expect(decision.selectedApproach).toBe('E');
    expect(decision.emergencyOverride).toBe(true);
    expect(decision.rationale).toContain('EMERGENCY VEHICLE CLEARANCE');
  });
});

describe('Signal Clearance Timing Transitions', () => {
  it('advances through GREEN -> YELLOW -> ALL_RED -> NEXT_GREEN sequentially', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      fixedGreenDuration: 10,
      yellowDuration: 3,
      allRedDuration: 1,
      controllerType: 'FIXED',
    });

    expect(engine.getCurrentPhase()).toBe('N_GREEN');

    // Step 10 seconds to finish green
    for (let i = 0; i < 20; i++) {
      engine.step(0.5);
    }

    // After 10s green, phase becomes N_YELLOW
    expect(engine.getCurrentPhase()).toBe('N_YELLOW');

    // Step 3 seconds of yellow
    for (let i = 0; i < 6; i++) {
      engine.step(0.5);
    }

    // After yellow, phase becomes ALL_RED
    expect(engine.getCurrentPhase()).toBe('ALL_RED');

    // Step 1 second of all-red
    for (let i = 0; i < 2; i++) {
      engine.step(0.5);
    }

    // Next phase is S_GREEN (sequential single-approach cycle)
    expect(engine.getCurrentPhase()).toBe('S_GREEN');
  });
});

