import { describe, expect, it } from 'vitest';
import { AdaptiveController } from '../controllers/AdaptiveController';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { DEFAULT_CONFIG, SCENARIO_PRESETS } from '../simulation/scenarios';
import { SafetyValidator } from '../simulation/safetyValidator';
import { ComparisonRunner } from '../analytics/comparisonEngine';
import { Approach, SimulationConfig, Vehicle } from '../types';

describe('Adaptive Signal Controller - Bug Fixes & Regression Suite', () => {
  const mockCar = (id: string, app: 'N' | 'S' | 'E' | 'W', waitTime: number = 0, state: 'queued' | 'approaching' | 'crossing' = 'queued'): Vehicle => ({
    id,
    approach: app,
    type: 'car',
    arrivalTime: 0,
    queueEntryTime: 0,
    departureTime: null,
    exitTime: null,
    state,
    distance: 180,
    speed: 0,
    waitingTime: waitTime,
    color: '#38bdf8',
  });

  // =========================================================================
  // Requirement 2 & 3: Empty Approach & Starvation Prevention Rules
  // =========================================================================
  describe('Empty-Road Starvation Overrides & Phase Selection (Req 2 & 3)', () => {
    it('never grants green or starvation override to an empty approach when other approaches have queued vehicles', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG, starvationThreshold: 40 };

      // West is completely empty (0 vehicles)
      // North has 3 vehicles waiting 15s
      // South has 1 vehicle waiting 20s
      const context = {
        currentTime: 50,
        currentApproach: 'N' as const,
        phaseElapsedTime: 15,
        queues: {
          N: [mockCar('n1', 'N', 15), mockCar('n2', 'N', 15), mockCar('n3', 'N', 15)],
          S: [mockCar('s1', 'S', 20)],
          E: [],
          W: [], // West empty
        },
        arrivalRates: { N: 10, S: 10, E: 5, W: 30 }, // Even if West has high arrival rate
        config,
      };

      const decision = controller.selectNextPhase(context);

      // West must NOT be selected, and must NOT trigger starvation override
      expect(decision.selectedApproach).not.toBe('W');
      expect(decision.starvationOverride).toBe(false);
      expect(decision.scores.W.queueCount).toBe(0);
      expect(decision.scores.W.isStarving).toBe(false);
      expect(decision.scores.W.rawScore).toBe(-999); // Disqualified with -Infinity
      expect(decision.allocatedDuration).toBeLessThanOrEqual(config.adaptiveMaxGreen);
    });

    it('applies starvation prevention ONLY when an approach has at least one genuinely queued vehicle', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG, starvationThreshold: 45 };

      // Scenario A: West has 0 queued vehicles, but simulation time is large (t=100s)
      const emptyWestContext = {
        currentTime: 100,
        currentApproach: 'S' as const,
        phaseElapsedTime: 20,
        queues: {
          N: [mockCar('n1', 'N', 10)],
          S: [],
          E: [],
          W: [], // West has 0 vehicles
        },
        arrivalRates: config.arrivalRates,
        config,
      };

      const decisionA = controller.selectNextPhase(emptyWestContext);
      expect(decisionA.scores.W.isStarving).toBe(false);
      expect(decisionA.starvationOverride).toBe(false);
      expect(decisionA.selectedApproach).toBe('N');

      // Scenario B: West actually has 1 queued vehicle waiting 55s (> 45s threshold)
      const genuineStarvingContext = {
        currentTime: 100,
        currentApproach: 'S' as const,
        phaseElapsedTime: 20,
        queues: {
          N: [mockCar('n1', 'N', 10), mockCar('n2', 'N', 10)],
          S: [],
          E: [],
          W: [mockCar('w1', 'W', 55)], // Genuinely queued and starving
        },
        arrivalRates: config.arrivalRates,
        config,
      };

      const decisionB = controller.selectNextPhase(genuineStarvingContext);
      expect(decisionB.scores.W.isStarving).toBe(true);
      expect(decisionB.starvationOverride).toBe(true);
      expect(decisionB.selectedApproach).toBe('W');
      // For 1 starving car, allocated green must be minimal green (10s), NOT 45s!
      expect(decisionB.allocatedDuration).toBe(config.adaptiveMinGreen);
      expect(decisionB.rationale).toContain('STARVATION OVERRIDE');
    });

    it('allocates minimal green duration (adaptiveMinGreen) during idle rotation when all queues are empty', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG, adaptiveMinGreen: 10, adaptiveMaxGreen: 45 };

      const idleContext = {
        currentTime: 0,
        currentApproach: null,
        phaseElapsedTime: 0,
        queues: { N: [], S: [], E: [], W: [] },
        arrivalRates: config.arrivalRates,
        config,
      };

      const decision = controller.selectNextPhase(idleContext);
      expect(decision.starvationOverride).toBe(false);
      expect(decision.allocatedDuration).toBe(config.adaptiveMinGreen);
      expect(decision.rationale).toContain('Adaptive Idle Rotation');
    });
  });

  // =========================================================================
  // Requirement 5: Early Green Phase Termination
  // =========================================================================
  describe('Early Green Phase Termination (Req 5)', () => {
    it('safely terminates green phase early once active queue is cleared after minGreen, preserving yellow and all-red clearance', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        adaptiveMinGreen: 10,
        adaptiveMaxGreen: 45,
        yellowDuration: 3,
        allRedDuration: 1,
        controllerType: 'ADAPTIVE',
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 }, // Disable automatic arrivals to control exact vehicles
      });

      engine.play();

      // Manually place 1 queued vehicle on North (currently green) and 3 on East (waiting at red)
      const northCar = mockCar('n-target', 'N', 0);
      const eastCar1 = mockCar('e1', 'E', 10);
      const eastCar2 = mockCar('e2', 'E', 10);
      (engine as any).vehicles.N = [northCar];
      (engine as any).vehicles.E = [eastCar1, eastCar2];
      (engine as any).currentPhaseDuration = 40; // Allocated 40s green initially

      expect(engine.getCurrentPhase()).toBe('N_GREEN');

      // Step 2 seconds: North car accelerates and crosses stop line into crossing state
      for (let i = 0; i < 4; i++) {
        engine.step(0.5);
      }

      // Fast forward distance of north car so it clears the intersection
      northCar.distance = 400; // Departed past exit line (380)

      // Step until currentTime reaches 9.5s (just before minGreen)
      while (engine.getCurrentTime() < 9.5) {
        engine.step(0.5);
        expect(engine.getCurrentPhase()).toBe('N_GREEN');
      }

      // Step to 10.0s: minGreen (10s) satisfied, queue is cleared, East approach is waiting.
      // Early green termination immediately triggers and transitions safely to N_YELLOW!
      engine.step(0.5);
      expect(engine.getCurrentPhase()).toBe('N_YELLOW');
      expect(engine.getCurrentPhaseDuration()).toBeLessThanOrEqual(10.5);

      // Yellow clearance lasts 3 seconds (6 steps of 0.5s)
      for (let i = 0; i < 6; i++) {
        expect(engine.getCurrentPhase()).toBe('N_YELLOW');
        engine.step(0.5);
      }

      // Next: All-Red clearance interval (1 second = 2 steps)
      expect(engine.getCurrentPhase()).toBe('ALL_RED');
      engine.step(0.5);
      engine.step(0.5);

      // Next: East approach receives green
      expect(engine.getCurrentPhase()).toBe('E_GREEN');
    });

    it('respects adaptiveMinGreen and does not cut green prematurely before minGreen is satisfied', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        adaptiveMinGreen: 10,
        controllerType: 'ADAPTIVE',
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
      });

      engine.play();

      // Active approach has 0 queued vehicles and East has 2 queued vehicles
      (engine as any).vehicles.N = [];
      (engine as any).vehicles.E = [mockCar('e1', 'E', 15), mockCar('e2', 'E', 15)];

      // At t = 4s (less than minGreen of 10s): phase MUST remain GREEN to honor min green safety rule
      for (let i = 0; i < 8; i++) {
        engine.step(0.5);
      }

      expect(engine.getPhaseElapsedTime()).toBe(4);
      expect(engine.getCurrentPhase()).toBe('N_GREEN');
    });
  });

  // =========================================================================
  // Requirement 4: Vehicle Arrival During Active Green Phase
  // =========================================================================
  describe('Vehicle Arrival During Active Green Phase (Req 4)', () => {
    it('allows controller to extend green when vehicles arrive during green without unsafe transitions', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG, adaptiveMaxGreen: 45 };

      const context = {
        currentTime: 25,
        currentApproach: 'N' as const,
        phaseElapsedTime: 25,
        queues: { N: [mockCar('n-new', 'N', 1)], S: [], E: [], W: [] },
        approachingVehicles: {
          N: [mockCar('n-app', 'N', 0, 'approaching')],
          S: [],
          E: [],
          W: [],
        },
        arrivalRates: config.arrivalRates,
        config,
      };

      const result = controller.shouldExtendCurrentGreen(context, 25);
      expect(result.extend).toBe(true);
      expect(result.additionalTime).toBeGreaterThan(0);
      expect(result.reason).toContain('Extended green');
    });

    it('denies green extension if maxGreen has been reached or if competing approaches are starving', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG, adaptiveMaxGreen: 45, starvationThreshold: 40 };

      // Competing approach (East) is starving with 50s wait time
      const starvingContext = {
        currentTime: 60,
        currentApproach: 'N' as const,
        phaseElapsedTime: 30,
        queues: {
          N: [mockCar('n1', 'N', 2)],
          S: [],
          E: [mockCar('e1', 'E', 50)], // Starving!
          W: [],
        },
        arrivalRates: config.arrivalRates,
        config,
      };

      const result = controller.shouldExtendCurrentGreen(starvingContext, 30);
      expect(result.extend).toBe(false);
      expect(result.reason).toContain('Competing approach [E] is starving');
    });
  });

  // =========================================================================
  // Requirement 6: Safety Invariants & Zero Conflicting Greens
  // =========================================================================
  describe('Signal Safety Invariants & Clearance Transitions (Req 6)', () => {
    it('strictly guarantees zero conflicting greens and legal phase sequencing across full simulation', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        controllerType: 'ADAPTIVE',
        simulationDuration: 180,
      });

      engine.play();

      let previousPhase = engine.getCurrentPhase();

      for (let t = 0.5; t <= 180; t += 0.5) {
        engine.step(0.5);
        const currentPhase = engine.getCurrentPhase();
        const signals = SafetyValidator.getSignalsForPhase(currentPhase);

        // Safety Invariant 1: No conflicting greens
        const safety = SafetyValidator.validateNoConflictingGreens(signals);
        expect(safety.safe).toBe(true);

        // Safety Invariant 2: Legal phase transition
        if (currentPhase !== previousPhase) {
          const transition = SafetyValidator.validatePhaseTransition(previousPhase, currentPhase);
          expect(transition.legal).toBe(true);
          previousPhase = currentPhase;
        }
      }
    });
  });

  // =========================================================================
  // Requirement 7: Queue and Visible State Synchronization
  // =========================================================================
  describe('Queue Counts and State Synchronization (Req 7)', () => {
    it('maintains strict 1:1 synchronization between simulation queue state and visible queues', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        controllerType: 'ADAPTIVE',
        simulationDuration: 60,
      });

      engine.play();

      for (let t = 0.5; t <= 60; t += 0.5) {
        engine.step(0.5);

        const internalQueues = engine.getQueuedVehiclesMap();
        const metrics = engine.getMetrics();
        const allVehicles = engine.getVehicles();

        for (const app of ['N', 'S', 'E', 'W'] as const) {
          const internalCount = internalQueues[app].length;
          const metricCount = metrics.approachQueues[app];
          const visibleQueuedCount = allVehicles[app].filter((v) => v.state === 'queued').length;

          expect(internalCount).toBe(metricCount);
          expect(internalCount).toBe(visibleQueuedCount);
        }
      }
    });
  });

  // =========================================================================
  // Requirement 8: Cyclic Idle Rotation & Emergency Preemption During Green
  // =========================================================================
  describe('Cyclic Idle Rotation & Emergency Preemption Fixes (Req 8)', () => {
    it('advances sequentially through all approaches during idle rotation without ping-ponging', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG };

      const emptyContext = (currentApproach: any) => ({
        currentTime: 0,
        currentApproach,
        phaseElapsedTime: 10,
        queues: { N: [], S: [], E: [], W: [] },
        arrivalRates: { N: 14, S: 14, E: 14, W: 14 },
        config,
      });

      // From initial boot (null), starts with N
      const d0 = controller.selectNextPhase(emptyContext(null));
      expect(d0.selectedApproach).toBe('N');

      // From N, must advance to S
      const d1 = controller.selectNextPhase(emptyContext('N'));
      expect(d1.selectedApproach).toBe('S');

      // From S, must advance to E
      const d2 = controller.selectNextPhase(emptyContext('S'));
      expect(d2.selectedApproach).toBe('E');

      // From E, must advance to W
      const d3 = controller.selectNextPhase(emptyContext('E'));
      expect(d3.selectedApproach).toBe('W');

      // From W, must advance back to N (deterministic 4-phase cyclic idle rotation)
      const d4 = controller.selectNextPhase(emptyContext('W'));
      expect(d4.selectedApproach).toBe('N');
    });

    it('denies green extension when a competing approach has a waiting emergency vehicle', () => {
      const controller = new AdaptiveController();
      const config = { ...DEFAULT_CONFIG, adaptiveMaxGreen: 45 };

      const emergencyVehicle: Vehicle = {
        ...mockCar('amb-1', 'E', 3),
        type: 'emergency',
        isEmergency: true,
      };

      const context = {
        currentTime: 25,
        currentApproach: 'N' as const,
        phaseElapsedTime: 25,
        queues: {
          N: [mockCar('n-new', 'N', 1)], // Demand exists on active approach
          S: [],
          E: [emergencyVehicle], // Emergency vehicle waiting on East!
          W: [],
        },
        approachingVehicles: { N: [], S: [], E: [], W: [] },
        arrivalRates: config.arrivalRates,
        config,
      };

      const result = controller.shouldExtendCurrentGreen(context, 25);
      expect(result.extend).toBe(false);
      expect(result.reason).toContain('emergency vehicle waiting');
    });

    it('expedites active green clearance to yellow when competing approach has waiting emergency vehicle', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        adaptiveMinGreen: 10,
        adaptiveMaxGreen: 45,
        yellowDuration: 3,
        allRedDuration: 1,
        controllerType: 'ADAPTIVE',
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
      });

      engine.play();

      // North has active vehicles (would normally run up to 45s)
      const northCar = mockCar('n-car', 'N', 0);
      const emergencyAmbulance: Vehicle = {
        ...mockCar('amb-1', 'E', 5),
        type: 'emergency',
        isEmergency: true,
      };

      (engine as any).vehicles.N = [northCar];
      (engine as any).vehicles.E = [emergencyAmbulance];
      (engine as any).currentPhaseDuration = 45; // 45s green allocated

      // Step until minGreen is satisfied (10s)
      for (let i = 0; i < 20; i++) {
        engine.step(0.5);
      }

      // At 10s (minGreen met), active green is immediately truncated for emergency vehicle!
      engine.step(0.5);
      expect(engine.getCurrentPhase()).toBe('N_YELLOW');
    });
  });

  // =========================================================================
  // Requirement 1, 2, 3, 5, 6: Comparison Lab Metrics, Events & Interpretation
  // =========================================================================
  describe('Comparison Lab Metrics & Interpretation Accuracy (Req 1, 2, 3, 5, 6)', () => {
    it('verifies exact Morning Rush metrics from actual simulation events (no fabrication)', () => {
      const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
      const config: SimulationConfig = {
        ...DEFAULT_CONFIG,
        ...preset.config,
        simulationDuration: 300,
      };

      const report = ComparisonRunner.runExperiment(config, preset.name);

      // Verify exact metrics reported in Comparison Lab (with red light violations eliminated)
      expect(report.fixed.avgWaitingTime).toBe(54.7);
      expect(report.adaptive.avgWaitingTime).toBe(28.3);
      expect(report.fixed.totalServed).toBe(244);
      expect(report.adaptive.totalServed).toBe(293);
      expect(report.fixed.remainingQueue).toBe(106);
      expect(report.adaptive.remainingQueue).toBe(52);

      // Verify identical seeded vehicle generations (seed: 101, duration: 300)
      expect(report.fixed.totalGenerated).toBe(354);
      expect(report.adaptive.totalGenerated).toBe(354);

      // Verify conservation of vehicles: totalServed + activeVehicles = totalGenerated (354)
      expect(report.fixed.totalServed + report.fixed.remainingQueue).toBeLessThanOrEqual(354);
      expect(report.adaptive.totalServed + report.adaptive.remainingQueue).toBeLessThanOrEqual(354);

      // Verify exact empirical deltas
      expect(report.deltas.avgWaitPercent).toBe(-48.3);
      expect(report.deltas.throughputPercent).toBe(20.1);
      expect(report.deltas.servedPercent).toBe(20.1);
      expect(report.deltas.queuePercent).toBe(-50.9);
    });

    it('corrects interpretation text to accurately reflect measured throughput and queue changes', () => {
      const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
      const config: SimulationConfig = {
        ...DEFAULT_CONFIG,
        ...preset.config,
        simulationDuration: 300,
      };

      const report = ComparisonRunner.runExperiment(config, preset.name);

      // Must accurately format throughput increase and queue reduction
      expect(report.interpretation).not.toContain('increasing vehicle throughput by -');
      expect(report.interpretation).toContain('increasing vehicle throughput by +20.1% (244 -> 293 served)');
      expect(report.interpretation).toContain('reducing remaining queue by 50.9% (106 -> 52)');
    });

    it('verifies that both controllers receive bit-exact identical vehicle arrivals and simulation durations', () => {
      const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
      const config: SimulationConfig = {
        ...DEFAULT_CONFIG,
        ...preset.config,
        simulationDuration: 300,
      };

      const fixedEngine = new SimulationEngine({ ...config, controllerType: 'FIXED' });
      const adaptiveEngine = new SimulationEngine({ ...config, controllerType: 'ADAPTIVE' });

      for (let s = 0; s < 600; s++) {
        fixedEngine.step(0.5);
        adaptiveEngine.step(0.5);
      }

      // Exact equal duration
      expect(fixedEngine.getCurrentTime()).toBe(300);
      expect(adaptiveEngine.getCurrentTime()).toBe(300);

      // Exact equal total vehicle generation
      expect(fixedEngine.getMetrics().totalGenerated).toBe(adaptiveEngine.getMetrics().totalGenerated);
      expect(fixedEngine.getMetrics().totalGenerated).toBe(354);
    });

    it('verifies queue and wait time calculations correlate with vehicle arrival, queue, and departure events', () => {
      const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
      const config: SimulationConfig = {
        ...DEFAULT_CONFIG,
        ...preset.config,
        simulationDuration: 300,
        controllerType: 'ADAPTIVE',
      };

      const engine = new SimulationEngine(config);
      for (let s = 0; s < 600; s++) {
        engine.step(0.5);
      }

      const m = engine.getMetrics();
      const allVehicles = engine.getVehicles();
      const queuedMap = engine.getQueuedVehiclesMap();

      // Check remaining queue equals vehicles with state 'queued'
      const actualQueuedTotal = ['N', 'S', 'E', 'W'].reduce(
        (sum, a) => sum + queuedMap[a as Approach].length,
        0
      );
      expect(m.remainingQueue).toBe(actualQueuedTotal);
      expect(m.currentQueued).toBe(actualQueuedTotal);

      // Verify all queued vehicles have waitingTime > 0
      for (const app of ['N', 'S', 'E', 'W'] as const) {
        for (const v of queuedMap[app]) {
          expect(v.waitingTime).toBeGreaterThan(0);
          expect(v.queueEntryTime).not.toBeNull();
        }
      }

      // Total generated equals served + active
      const activeTotal = ['N', 'S', 'E', 'W'].reduce(
        (sum, a) => sum + allVehicles[a as Approach].length,
        0
      );
      expect(m.totalServed + activeTotal).toBe(m.totalGenerated);
    });
  });

  // =========================================================================
  // Requirement 1, 2, 3, 4, 5, 6: Red-Light Violation Prevention & Stop-Line Invariants
  // =========================================================================
  describe('Red-Light Violation Prevention & Stop-Line Invariants (Req 1, 2, 3, 4, 5, 6)', () => {
    it('enforces stop-line behavior when a vehicle approaches a red signal', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        fixedGreenDuration: 30,
        controllerType: 'FIXED',
      });

      engine.play();
      // Current phase is N_GREEN; East approach signal is RED
      expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).E).toBe('RED');

      // Place an approaching car on East at distance 60 traveling at speed 50
      const carE: Vehicle = {
        ...mockCar('e-app', 'E', 0, 'approaching'),
        distance: 60,
        speed: 50,
      };
      (engine as any).vehicles.E = [carE];

      // Step forward 12 seconds (24 steps of 0.5s) while East remains RED
      for (let s = 0; s < 24; s++) {
        engine.step(0.5);
        expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).E).toBe('RED');
        // Vehicle distance must NEVER exceed STOP_LINE while signal is RED
        expect(carE.distance).toBeLessThanOrEqual(SimulationEngine.STOP_LINE);
      }

      // Verify final stopping behavior: front bumper stops approximately 15-20 pixels before STOP_LINE, state queued
      const leadStop = SimulationEngine.getLeadStopDistance(carE);
      expect(carE.distance).toBeCloseTo(leadStop, 1);
      expect(carE.distance).toBeLessThan(SimulationEngine.STOP_LINE);

      const frontBumperDist = SimulationEngine.getFrontBumperDistance(carE);
      const frontBumperPxBeforeStopLine = (SimulationEngine.STOP_LINE - frontBumperDist) * (188 / 180);
      expect(frontBumperPxBeforeStopLine).toBeGreaterThanOrEqual(15);
      expect(frontBumperPxBeforeStopLine).toBeLessThanOrEqual(20);

      expect(carE.speed).toBe(0);
      expect(carE.state).toBe('queued');
      expect(carE.waitingTime).toBeGreaterThan(0);
      expect(carE.queueEntryTime).not.toBeNull();
      expect(carE.departureTime).toBeNull();
    });

    it('holds multiple queued vehicles stationary behind a red signal maintaining vehicle gap', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
      });

      engine.play();
      // South approach is RED during EW_GREEN
      (engine as any).currentPhase = 'EW_GREEN';
      expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).S).toBe('RED');

      // 4 queued vehicles spaced with proper front-to-rear gap
      const leadDist = SimulationEngine.getLeadStopDistance(mockCar('s0', 'S', 10));
      const s0 = { ...mockCar('s0', 'S', 10), distance: leadDist, speed: 0 };
      const s1Dist = SimulationEngine.getFollowingStopDistance(mockCar('s1', 'S', 8), s0);
      const s1 = { ...mockCar('s1', 'S', 8), distance: s1Dist, speed: 0 };
      const s2Dist = SimulationEngine.getFollowingStopDistance(mockCar('s2', 'S', 6), s1);
      const s2 = { ...mockCar('s2', 'S', 6), distance: s2Dist, speed: 0 };
      const s3Dist = SimulationEngine.getFollowingStopDistance(mockCar('s3', 'S', 4), s2);
      const s3 = { ...mockCar('s3', 'S', 4), distance: s3Dist, speed: 0 };
      (engine as any).vehicles.S = [s0, s1, s2, s3];

      // Step 8 seconds while South remains RED
      for (let s = 0; s < 16; s++) {
        engine.step(0.5);
        expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).S).toBe('RED');

        // All 4 vehicles must remain stationary at exact positions
        expect(s0.distance).toBeCloseTo(leadDist, 1);
        expect(s1.distance).toBeCloseTo(s1Dist, 1);
        expect(s2.distance).toBeCloseTo(s2Dist, 1);
        expect(s3.distance).toBeCloseTo(s3Dist, 1);

        expect(s0.speed).toBe(0);
        expect(s1.speed).toBe(0);
        expect(s2.speed).toBe(0);
        expect(s3.speed).toBe(0);

        expect(s0.state).toBe('queued');
        expect(s1.state).toBe('queued');
        expect(s2.state).toBe('queued');
        expect(s3.state).toBe('queued');
      }
    });

    it('halts vehicles before the stop line when signal transitions from GREEN to RED while vehicles approach', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        fixedGreenDuration: 5,
        yellowDuration: 3,
        allRedDuration: 1,
        controllerType: 'FIXED',
      });

      engine.play();
      expect(engine.getCurrentPhase()).toBe('N_GREEN');

      // Approaching vehicles on North: n1 at 30, n2 at 0
      const n1: Vehicle = { ...mockCar('n1', 'N', 0, 'approaching'), distance: 30, speed: 40 };
      const n2: Vehicle = { ...mockCar('n2', 'N', 0, 'approaching'), distance: 0, speed: 40 };
      (engine as any).vehicles.N = [n1, n2];

      // Green has 1 second remaining (4s of 5s elapsed)
      (engine as any).currentPhaseDuration = 5.0;
      (engine as any).phaseElapsedTime = 4.0;

      // Step forward 8 seconds (16 steps of 0.5s):
      // N_GREEN (1s remaining) -> N_YELLOW (3s) -> ALL_RED (1s) -> S_GREEN (North is RED)
      for (let s = 0; s < 16; s++) {
        engine.step(0.5);
        const currentSignals = SafetyValidator.getSignalsForPhase(engine.getCurrentPhase());
        if (currentSignals.N === 'RED') {
          // While North is RED, vehicles must NEVER exceed the stop line
          expect(n1.distance).toBeLessThan(SimulationEngine.STOP_LINE);
          expect(n2.distance).toBeLessThan(n1.distance);
        }
      }

      // Both vehicles must be stopped cleanly before the stop line
      const expectedN1Dist = SimulationEngine.getLeadStopDistance(n1);
      const expectedN2Dist = SimulationEngine.getFollowingStopDistance(n2, n1);
      expect(n1.distance).toBeCloseTo(expectedN1Dist, 1);
      expect(n1.speed).toBe(0);
      expect(n1.state).toBe('queued');

      expect(n2.distance).toBeCloseTo(expectedN2Dist, 1);
      expect(n2.speed).toBe(0);
      expect(n2.state).toBe('queued');

      expect(n1.departureTime).toBeNull();
      expect(n2.departureTime).toBeNull();
    });

    it('allows vehicles already inside the intersection to clear safely when signal turns RED', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
      });

      engine.play();

      // nCrossing is already past stop line (distance 220, inside intersection)
      const nCrossing: Vehicle = {
        ...mockCar('n-crossing', 'N', 5, 'crossing'),
        distance: 220,
        speed: 60,
        departureTime: 10,
      };

      // nWaiting is stopped before stop line
      const leadDist = SimulationEngine.getLeadStopDistance(mockCar('n-waiting', 'N', 10));
      const nWaiting: Vehicle = {
        ...mockCar('n-waiting', 'N', 10, 'queued'),
        distance: leadDist,
        speed: 0,
      };

      (engine as any).vehicles.N = [nCrossing, nWaiting];

      // Signal changes to EW_GREEN (North is RED)
      (engine as any).currentPhase = 'EW_GREEN';
      expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).N).toBe('RED');

      // Step forward 6 seconds (12 half-second steps)
      for (let s = 0; s < 12; s++) {
        engine.step(0.5);
        // nWaiting must NOT move while North is RED
        expect(nWaiting.distance).toBeCloseTo(leadDist, 1);
        expect(nWaiting.speed).toBe(0);
        expect(nWaiting.state).toBe('queued');
      }

      // nCrossing must have successfully cleared through to departure
      const served = (engine as any).servedVehicles;
      const isServed = served.some((v: Vehicle) => v.id === 'n-crossing');
      expect(isServed).toBe(true);

      // nWaiting still safely waiting before the stop line
      expect(nWaiting.distance).toBeCloseTo(leadDist, 1);
      expect(nWaiting.state).toBe('queued');
      expect(nWaiting.departureTime).toBeNull();
    });

    it('guarantees zero vehicles cross stop line during RED or ALL_RED across full simulation for both controllers', () => {
      const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
      const config: SimulationConfig = {
        ...DEFAULT_CONFIG,
        ...preset.config,
        simulationDuration: 300,
      };

      for (const controllerType of ['FIXED', 'ADAPTIVE'] as const) {
        const engine = new SimulationEngine({ ...config, controllerType });
        const violations: Array<{ time: number; vehicleId: string; approach: Approach; prevDist: number; newDist: number; signal: string; phase: string }> = [];

        for (let step = 0; step < 600; step++) {
          const vehiclesBefore = JSON.parse(JSON.stringify(engine.getVehicles()));

          engine.step(0.5);

          const vehiclesAfter = engine.getVehicles();
          const phaseAfter = engine.getCurrentPhase();
          const signalsAfter = SafetyValidator.getSignalsForPhase(phaseAfter);

          for (const app of ['N', 'S', 'E', 'W'] as Approach[]) {
            const beforeList = vehiclesBefore[app];
            const afterList = vehiclesAfter[app];

            for (const va of afterList) {
              const vb = beforeList.find((x: any) => x.id === va.id);
              if (vb) {
                // Check if vehicle was at or before stop line (<= 180) and entered intersection (> 180)
                if (vb.distance <= SimulationEngine.STOP_LINE && va.distance > SimulationEngine.STOP_LINE) {
                  // Was signal RED or ALL_RED during the physics update?
                  if (signalsAfter[app] === 'RED') {
                    violations.push({
                      time: engine.getCurrentTime(),
                      vehicleId: va.id,
                      approach: app,
                      prevDist: vb.distance,
                      newDist: va.distance,
                      signal: signalsAfter[app],
                      phase: phaseAfter,
                    });
                  }
                }
              }
            }
          }
        }

        expect(violations.length, `Expected 0 red light violations for ${controllerType}`).toBe(0);
      }
    });
  });

  // =========================================================================
  // Front Bumper Stopping Position & Physics Invariants (Req 1, 2, 3, 4, 5, 6, 7, 8)
  // =========================================================================
  describe('Front Bumper Stopping Position & Physics Invariants (Req 1-8)', () => {
    const getMappedOffset = (dist: number): number => {
      if (dist <= 180) {
        return 50 + (dist / 180) * (238 - 50);
      }
      if (dist <= 260) {
        return 238 + ((dist - 180) / (260 - 180)) * (362 - 238);
      }
      return 362 + ((Math.min(dist, 380) - 260) / (380 - 260)) * (580 - 362);
    };

    const getFrontBumperCoordinates = (v: Vehicle): { x: number; y: number } => {
      const offset = getMappedOffset(v.distance);
      const halfLen = SimulationEngine.getVehicleLength(v.type) / 2;

      switch (v.approach) {
        case 'N':
          // North moves South (y: 50 -> 238). Stop line at y = 238.
          return { x: 270, y: offset + halfLen };
        case 'S':
          // South moves North (y: 550 -> 362). Stop line at y = 362.
          return { x: 330, y: 600 - offset - halfLen };
        case 'E':
          // East moves West (x: 550 -> 362). Stop line at x = 362.
          return { x: 600 - offset - halfLen, y: 270 };
        case 'W':
          // West moves East (x: 50 -> 238). Stop line at x = 238.
          return { x: offset + halfLen, y: 330 };
      }
    };

    const getFrontBumperDistanceToStopLinePx = (v: Vehicle): number => {
      const bumper = getFrontBumperCoordinates(v);
      switch (v.approach) {
        case 'N':
          return 238 - bumper.y;
        case 'S':
          return bumper.y - 362;
        case 'E':
          return bumper.x - 362;
        case 'W':
          return 238 - bumper.x;
      }
    };

    it('consistently stops front bumper approximately 15-20 pixels before stop line across all 4 approaches (N, S, E, W)', () => {
      const approaches: Approach[] = ['N', 'S', 'E', 'W'];

      for (const app of approaches) {
        const engine = new SimulationEngine({
          ...DEFAULT_CONFIG,
          arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
          fixedGreenDuration: 30,
          controllerType: 'FIXED',
        });
        engine.play();

        const redPhase = (app === 'N' || app === 'S') ? 'E_GREEN' : 'N_GREEN';
        (engine as any).currentPhase = redPhase;
        expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase())[app]).toBe('RED');

        const car: Vehicle = {
          ...mockCar(`car-${app}`, app, 0, 'approaching'),
          distance: 50,
          speed: 50,
        };
        (engine as any).vehicles[app] = [car];

        for (let s = 0; s < 25; s++) {
          engine.step(0.5);
        }

        expect(car.state).toBe('queued');
        expect(car.speed).toBe(0);

        const pxBeforeStopLine = getFrontBumperDistanceToStopLinePx(car);
        expect(pxBeforeStopLine).toBeGreaterThanOrEqual(15);
        expect(pxBeforeStopLine).toBeLessThanOrEqual(20);
        expect(pxBeforeStopLine).toBeCloseTo(17.0, 0.5);
      }
    });

    it('calculates stopping position using front bumper across all vehicle types (car, bus, truck, emergency)', () => {
      const types: Array<Vehicle['type']> = ['car', 'bus', 'truck', 'emergency'];

      for (const type of types) {
        const engine = new SimulationEngine({
          ...DEFAULT_CONFIG,
          arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
          controllerType: 'FIXED',
        });
        engine.play();

        expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).E).toBe('RED');

        const veh: Vehicle = {
          ...mockCar(`veh-${type}`, 'E', 0, 'approaching'),
          type,
          distance: 40,
          speed: 55,
          isEmergency: type === 'emergency',
        };
        (engine as any).vehicles.E = [veh];

        for (let s = 0; s < 25; s++) {
          engine.step(0.5);
        }

        expect(veh.state).toBe('queued');
        expect(veh.speed).toBe(0);

        const pxBeforeStopLine = getFrontBumperDistanceToStopLinePx(veh);
        expect(pxBeforeStopLine).toBeGreaterThanOrEqual(15);
        expect(pxBeforeStopLine).toBeLessThanOrEqual(20);
        expect(pxBeforeStopLine).toBeCloseTo(17.0, 0.5);
      }
    });

    it('maintains proper spacing between queued vehicles without overlapping', () => {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
      });
      engine.play();

      (engine as any).currentPhase = 'E_GREEN';
      expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).N).toBe('RED');

      const v0: Vehicle = {
        ...mockCar('v0-bus', 'N', 0, 'approaching'),
        type: 'bus',
        distance: 80,
        speed: 40,
      };
      const v1: Vehicle = {
        ...mockCar('v1-car', 'N', 0, 'approaching'),
        type: 'car',
        distance: 40,
        speed: 40,
      };
      const v2: Vehicle = {
        ...mockCar('v2-truck', 'N', 0, 'approaching'),
        type: 'truck',
        distance: 10,
        speed: 40,
      };

      (engine as any).vehicles.N = [v0, v1, v2];

      for (let s = 0; s < 30; s++) {
        engine.step(0.5);
      }

      expect(v0.state).toBe('queued');
      expect(v1.state).toBe('queued');
      expect(v2.state).toBe('queued');

      const v0RearPx = getMappedOffset(v0.distance) - SimulationEngine.getVehicleLength(v0.type) / 2;
      const v1FrontPx = getMappedOffset(v1.distance) + SimulationEngine.getVehicleLength(v1.type) / 2;
      const gap01 = v0RearPx - v1FrontPx;
      expect(gap01).toBeGreaterThanOrEqual(5.0);

      const v1RearPx = getMappedOffset(v1.distance) - SimulationEngine.getVehicleLength(v1.type) / 2;
      const v2FrontPx = getMappedOffset(v2.distance) + SimulationEngine.getVehicleLength(v2.type) / 2;
      const gap12 = v1RearPx - v2FrontPx;
      expect(gap12).toBeGreaterThanOrEqual(5.0);
    });

    it('ensures front bumper never crosses stop line during RED or ALL_RED for both controllers', () => {
      const preset = SCENARIO_PRESETS.find((s) => s.id === 'morning-rush')!;
      const config: SimulationConfig = {
        ...DEFAULT_CONFIG,
        ...preset.config,
        simulationDuration: 180,
      };

      for (const controllerType of ['FIXED', 'ADAPTIVE'] as const) {
        const engine = new SimulationEngine({ ...config, controllerType });
        let frontBumperViolations = 0;

        for (let step = 0; step < 360; step++) {
          engine.step(0.5);
          const signals = SafetyValidator.getSignalsForPhase(engine.getCurrentPhase());
          const vehicles = engine.getVehicles();

          for (const app of ['N', 'S', 'E', 'W'] as Approach[]) {
            if (signals[app] === 'RED') {
              for (const v of vehicles[app]) {
                if (v.state === 'approaching' || v.state === 'queued') {
                  const frontBumper = SimulationEngine.getFrontBumperDistance(v);
                  if (frontBumper > SimulationEngine.STOP_LINE) {
                    frontBumperViolations++;
                  }
                }
              }
            }
          }
        }

        expect(frontBumperViolations, `Expected 0 front bumper violations for ${controllerType}`).toBe(0);
      }
    });
  });
});

