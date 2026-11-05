import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SafetyValidator } from '../simulation/safetyValidator';
import { DEFAULT_CONFIG } from '../simulation/scenarios';
import { Approach, Vehicle, VehicleType } from '../types';

describe('Vehicle Stopping Position & Front Bumper Invariants', () => {
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
        // North travels South (increasing y). Stop line at y = 238.
        return { x: 270, y: offset + halfLen };
      case 'S':
        // South travels North (decreasing y). Stop line at y = 362.
        return { x: 330, y: 600 - offset - halfLen };
      case 'E':
        // East travels West (decreasing x). Stop line at x = 362.
        return { x: 600 - offset - halfLen, y: 270 };
      case 'W':
        // West travels East (increasing x). Stop line at x = 238.
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

  it('stops front bumper approximately 15-20 pixels before white stop line across all 4 approaches', () => {
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];

    for (const app of approaches) {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        fixedGreenDuration: 30,
        controllerType: 'FIXED',
      });
      engine.play();

      // Ensure signal for this approach is RED by setting phase to orthogonal green
      const redPhase = (app === 'N' || app === 'S') ? 'EW_GREEN' : 'NS_GREEN';
      (engine as any).currentPhase = redPhase;
      expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase())[app]).toBe('RED');

      const car: Vehicle = {
        id: `car-${app}`,
        approach: app,
        type: 'car',
        arrivalTime: 0,
        queueEntryTime: null,
        departureTime: null,
        exitTime: null,
        state: 'approaching',
        distance: 50,
        speed: 50,
        waitingTime: 0,
        color: '#fff',
      };
      (engine as any).vehicles[app] = [car];

      // Step forward until car comes to a complete halt
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

  it('calculates stopping position using front bumper consistently across all vehicle types (car, bus, truck, emergency)', () => {
    const types: VehicleType[] = ['car', 'bus', 'truck', 'emergency'];

    for (const type of types) {
      const engine = new SimulationEngine({
        ...DEFAULT_CONFIG,
        arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
        controllerType: 'FIXED',
      });
      engine.play();

      // East is RED during N_GREEN
      expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).E).toBe('RED');

      const veh: Vehicle = {
        id: `veh-${type}`,
        approach: 'E',
        type,
        arrivalTime: 0,
        queueEntryTime: null,
        departureTime: null,
        exitTime: null,
        state: 'approaching',
        distance: 40,
        speed: 55,
        waitingTime: 0,
        color: '#fff',
        isEmergency: type === 'emergency',
      };
      (engine as any).vehicles.E = [veh];

      for (let s = 0; s < 25; s++) {
        engine.step(0.5);
      }

      expect(veh.state).toBe('queued');
      expect(veh.speed).toBe(0);

      // Verify that every vehicle type has its front bumper at ~17px before stop line
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

    // North is RED during EW_GREEN
    (engine as any).currentPhase = 'EW_GREEN';
    expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).N).toBe('RED');

    // Create a heterogeneous queue: bus ahead, car behind, truck behind, car behind
    const v0: Vehicle = {
      id: 'v0-bus',
      approach: 'N',
      type: 'bus',
      arrivalTime: 0,
      queueEntryTime: null,
      departureTime: null,
      exitTime: null,
      state: 'approaching',
      distance: 80,
      speed: 40,
      waitingTime: 0,
      color: '#fff',
    };
    const v1: Vehicle = {
      id: 'v1-car',
      approach: 'N',
      type: 'car',
      arrivalTime: 0,
      queueEntryTime: null,
      departureTime: null,
      exitTime: null,
      state: 'approaching',
      distance: 40,
      speed: 40,
      waitingTime: 0,
      color: '#fff',
    };
    const v2: Vehicle = {
      id: 'v2-truck',
      approach: 'N',
      type: 'truck',
      arrivalTime: 0,
      queueEntryTime: null,
      departureTime: null,
      exitTime: null,
      state: 'approaching',
      distance: 10,
      speed: 40,
      waitingTime: 0,
      color: '#fff',
    };

    (engine as any).vehicles.N = [v0, v1, v2];

    for (let s = 0; s < 30; s++) {
      engine.step(0.5);
    }

    // All must be queued and stationary
    expect(v0.state).toBe('queued');
    expect(v1.state).toBe('queued');
    expect(v2.state).toBe('queued');
    expect(v0.speed).toBe(0);
    expect(v1.speed).toBe(0);
    expect(v2.speed).toBe(0);

    // Check bumper-to-bumper gap between v0 (bus) and v1 (car)
    const v0RearPx = getMappedOffset(v0.distance) - SimulationEngine.getVehicleLength(v0.type) / 2;
    const v1FrontPx = getMappedOffset(v1.distance) + SimulationEngine.getVehicleLength(v1.type) / 2;
    const gap01 = v0RearPx - v1FrontPx;
    expect(gap01).toBeGreaterThanOrEqual(5.0); // No overlap, proper clearance

    // Check bumper-to-bumper gap between v1 (car) and v2 (truck)
    const v1RearPx = getMappedOffset(v1.distance) - SimulationEngine.getVehicleLength(v1.type) / 2;
    const v2FrontPx = getMappedOffset(v2.distance) + SimulationEngine.getVehicleLength(v2.type) / 2;
    const gap12 = v1RearPx - v2FrontPx;
    expect(gap12).toBeGreaterThanOrEqual(5.0); // No overlap, proper clearance
  });

  it('guarantees smooth deceleration and no sudden position jumps while approaching stop position', () => {
    const engine = new SimulationEngine({
      ...DEFAULT_CONFIG,
      arrivalRates: { N: 0, S: 0, E: 0, W: 0 },
      controllerType: 'FIXED',
    });
    engine.play();

    // South is RED during EW_GREEN
    (engine as any).currentPhase = 'EW_GREEN';
    expect(SafetyValidator.getSignalsForPhase(engine.getCurrentPhase()).S).toBe('RED');

    const carS: Vehicle = {
      id: 'car-s-smooth',
      approach: 'S',
      type: 'car',
      arrivalTime: 0,
      queueEntryTime: null,
      departureTime: null,
      exitTime: null,
      state: 'approaching',
      distance: 30,
      speed: 60,
      waitingTime: 0,
      color: '#fff',
    };
    (engine as any).vehicles.S = [carS];

    let prevDist = carS.distance;
    let prevSpeed = carS.speed;

    for (let s = 0; s < 30; s++) {
      engine.step(0.2); // smaller dt to track trajectory smoothness

      // Vehicle must never move backwards
      expect(carS.distance).toBeGreaterThanOrEqual(prevDist);

      // Max travel per 0.2s tick should not jump unexpectedly
      const deltaDist = carS.distance - prevDist;
      expect(deltaDist).toBeLessThanOrEqual(Math.max(0.5, prevSpeed * 0.2 + 0.1));

      prevDist = carS.distance;
      prevSpeed = carS.speed;
    }

    expect(carS.state).toBe('queued');
    expect(carS.speed).toBe(0);
    const pxBeforeStopLine = getFrontBumperDistanceToStopLinePx(carS);
    expect(pxBeforeStopLine).toBeCloseTo(17.0, 0.5);
  });
});
