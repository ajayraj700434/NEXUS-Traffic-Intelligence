import { Approach, ApproachArrivalRates, MovementType, Vehicle, VehicleType } from '../types';
import { SeededPRNG } from './prng';
import { getTargetApproach } from './movementConflicts';

export class TrafficGenerator {
  private prng: SeededPRNG;
  private vehicleCounter: number = 0;
  private vehicleColors: string[] = [
    '#38bdf8', // Sky blue
    '#818cf8', // Indigo
    '#a78bfa', // Purple
    '#f472b6', // Pink
    '#fb923c', // Orange
    '#e2e8f0', // Silver / White
    '#94a3b8', // Slate grey
    '#4ade80', // Mint green
  ];

  constructor(private seed: number) {
    this.prng = new SeededPRNG(seed);
  }

  /**
   * Generates vehicles that arrive during this time step dt.
   * Arrival probability per approach per second: rate / 60
   */
  generateStep(
    dt: number,
    currentTime: number,
    arrivalRates: ApproachArrivalRates,
    forceEmergencyApproach?: Approach | null
  ): Vehicle[] {
    const arrivals: Vehicle[] = [];
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];

    for (const app of approaches) {
      const vpm = arrivalRates[app];
      // Probability of at least one arrival in time dt (Poisson approximation)
      const lambda = (vpm / 60) * dt;
      const willArrive = this.prng.chance(Math.min(0.9, lambda));

      const isForcedEmergency = forceEmergencyApproach === app;

      if (willArrive || isForcedEmergency) {
        this.vehicleCounter++;
        let type: VehicleType = 'car';
        let isEmergency = false;

        if (isForcedEmergency) {
          type = 'emergency';
          isEmergency = true;
        } else {
          const typeRoll = this.prng.next();
          if (typeRoll < 0.03) {
            type = 'emergency';
            isEmergency = true;
          } else if (typeRoll < 0.13) {
            type = 'bus';
          } else if (typeRoll < 0.23) {
            type = 'truck';
          } else {
            type = 'car';
          }
        }

        const colorIndex = this.prng.nextInt(0, this.vehicleColors.length - 1);
        const color = isEmergency ? '#ef4444' : this.vehicleColors[colorIndex];

        // Vehicle enters the road at distance 0 (approx 200px before stop line)
        // Default movement is STRAIGHT; turning movements can be specified explicitly or per scenario
        const movement: MovementType = 'STRAIGHT';
        const targetApproach = getTargetApproach(app, movement);

        const vehicle: Vehicle = {
          id: `veh-${app}-${this.vehicleCounter}`,
          approach: app,
          type,
          movement,
          targetApproach,
          arrivalTime: Math.round(currentTime * 10) / 10,
          queueEntryTime: null,
          departureTime: null,
          exitTime: null,
          state: 'approaching',
          distance: 0,
          speed: 60, // 60 px/s normal cruise
          waitingTime: 0,
          color,
          isEmergency,
        };

        arrivals.push(vehicle);
      }
    }

    return arrivals;
  }

  reset(seed: number = this.seed): void {
    this.seed = seed;
    this.prng = new SeededPRNG(seed);
    this.vehicleCounter = 0;
  }
}
