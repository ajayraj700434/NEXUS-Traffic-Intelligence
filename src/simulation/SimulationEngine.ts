import {
  Approach,
  ControllerDecision,
  PhaseType,
  SignalState,
  SignalStatus,
  SimulationConfig,
  SimulationEvent,
  SimulationMetrics,
  Vehicle,
} from '../types';
import { BaseController } from '../controllers/BaseController';
import { FixedTimeController } from '../controllers/FixedTimeController';
import { AdaptiveController } from '../controllers/AdaptiveController';
import { SafetyValidator, SignalVector } from './safetyValidator';
import { TrafficGenerator } from './trafficGenerator';

export class SimulationEngine {
  private config: SimulationConfig;
  private controller: BaseController;
  private generator: TrafficGenerator;

  // Simulation Clock
  private currentTime: number = 0;
  private isRunning: boolean = false;
  private speedMultiplier: number = 1.0;

  // Signal State Machine
  private currentPhase: PhaseType = 'N_GREEN';
  private phaseElapsedTime: number = 0;
  private currentPhaseDuration: number = 25; // allocated green
  private lastDecision: ControllerDecision | null = null;

  // Vehicles
  private vehicles: Record<Approach, Vehicle[]> = {
    N: [],
    S: [],
    E: [],
    W: [],
  };
  private servedVehicles: Vehicle[] = [];
  private allGeneratedCount: number = 0;
  private phaseChangeCount: number = 0;

  // Events & Logs
  private events: SimulationEvent[] = [];
  private maxEventHistory: number = 400;

  // Geometry Constants
  static readonly STOP_LINE = 180;
  static readonly INTERSECTION_END = 260;
  static readonly EXIT_LINE = 380;
  static readonly VEHICLE_GAP = 28;
  static readonly STOP_BUFFER_PX = 17; // 17 pixels before white stop line (within 15-20px requirement)
  static readonly QUEUE_GAP_PX = 5.25; // Proper bumper-to-bumper spacing between queued vehicles (ensures 0 overlap)

  static getVehicleLength(type: Vehicle['type']): number {
    switch (type) {
      case 'bus':
        return 36;
      case 'truck':
        return 32;
      case 'car':
      case 'emergency':
      default:
        return 24;
    }
  }

  static getFrontBumperDistance(v: Vehicle): number {
    return v.distance + (SimulationEngine.getVehicleLength(v.type) / 2) * (180 / 188);
  }

  static getRearBumperDistance(v: Vehicle): number {
    return v.distance - (SimulationEngine.getVehicleLength(v.type) / 2) * (180 / 188);
  }

  static getLeadStopDistance(v: Vehicle): number {
    const halfLenDist = (SimulationEngine.getVehicleLength(v.type) / 2) * (180 / 188);
    const stopBufferDist = SimulationEngine.STOP_BUFFER_PX * (180 / 188);
    return Math.max(0, SimulationEngine.STOP_LINE - stopBufferDist - halfLenDist);
  }

  static getFollowingStopDistance(v: Vehicle, ahead: Vehicle): number {
    const halfLenAhead = (SimulationEngine.getVehicleLength(ahead.type) / 2) * (180 / 188);
    const halfLenV = (SimulationEngine.getVehicleLength(v.type) / 2) * (180 / 188);
    const gapDist = SimulationEngine.QUEUE_GAP_PX * (180 / 188);
    const minSafeGap = halfLenAhead + halfLenV + gapDist;
    return Math.max(0, ahead.distance - minSafeGap);
  }

  constructor(config: SimulationConfig) {
    this.config = { ...config };
    this.generator = new TrafficGenerator(this.config.seed);
    this.controller =
      this.config.controllerType === 'ADAPTIVE'
        ? new AdaptiveController()
        : new FixedTimeController();

    this.initializeFirstPhase();
  }

  private initializeFirstPhase(): void {
    this.currentPhase = 'N_GREEN';
    this.phaseElapsedTime = 0;
    this.currentPhaseDuration =
      this.config.controllerType === 'ADAPTIVE'
        ? this.config.adaptiveMinGreen
        : this.config.fixedGreenDuration;

    this.addEvent({
      id: `evt-init-${Date.now()}`,
      timestamp: 0,
      type: 'SYSTEM_RESET',
      severity: 'info',
      approach: 'ALL',
      message: `Simulation initialized with ${this.config.controllerType} controller (Seed: ${this.config.seed})`,
    });

    // Make initial decision
    const decision = this.controller.selectNextPhase({
      currentTime: 0,
      currentApproach: null,
      phaseElapsedTime: 0,
      queues: this.getQueuedVehiclesMap(),
      approachingVehicles: this.getApproachingVehiclesMap(),
      arrivalRates: this.config.arrivalRates,
      config: this.config,
    });
    this.lastDecision = decision;
    this.currentPhase = `${decision.selectedApproach}_GREEN` as PhaseType;
    this.currentPhaseDuration = decision.allocatedDuration;
  }

  /**
   * Main simulation step update
   */
  step(dt: number): void {
    if (this.currentTime >= this.config.simulationDuration) {
      this.isRunning = false;
      return;
    }

    this.currentTime += dt;
    this.phaseElapsedTime += dt;

    // 1. Generate new vehicle arrivals
    const newVehicles = this.generator.generateStep(
      dt,
      this.currentTime,
      this.config.arrivalRates
    );

    for (const v of newVehicles) {
      this.vehicles[v.approach].push(v);
      this.allGeneratedCount++;
      this.addEvent({
        id: `evt-arr-${v.id}`,
        timestamp: this.currentTime,
        type: 'VEHICLE_ARRIVED',
        severity: v.isEmergency ? 'alert' : 'info',
        approach: v.approach,
        message: `${v.isEmergency ? 'EMERGENCY ' : ''}${v.type.toUpperCase()} #${v.id} arrived at [${v.approach}] approach`,
      });
    }

    // 2. Update signal state machine
    this.updateSignals(dt);

    // 3. Update vehicle physics, queues & departures
    this.updateVehiclePhysics(dt);
  }

  private updateSignals(dt: number): void {
    const signals = SafetyValidator.getSignalsForPhase(this.currentPhase);
    const safetyCheck = SafetyValidator.validateNoConflictingGreens(signals);
    if (!safetyCheck.safe) {
      console.error(safetyCheck.reason);
      this.addEvent({
        id: `evt-err-${Date.now()}`,
        timestamp: this.currentTime,
        type: 'PHASE_CHANGE',
        severity: 'alert',
        approach: 'ALL',
        message: safetyCheck.reason || 'Safety error',
      });
      return;
    }

    if (this.currentPhase.endsWith('_GREEN')) {
      const activeApp = this.currentPhase.replace(/_GREEN$/, '') as Approach;
      const competingApps: Approach[] = (['N', 'S', 'E', 'W'] as Approach[]).filter((a) => a !== activeApp);

      const queuedMap = this.getQueuedVehiclesMap();
      const activeQueueCount = queuedMap[activeApp]?.length || 0;
      const competingWaitingCount = competingApps.reduce((sum, a) => sum + (queuedMap[a]?.length || 0), 0);

      // Check if active approach queue is cleared and no vehicle is approaching within stop zone
      const hasApproachingNearStopLine = (this.vehicles[activeApp] || []).some(
        (v) =>
          v.state !== 'crossing' &&
          v.distance >= SimulationEngine.STOP_LINE - 40 &&
          v.distance < SimulationEngine.STOP_LINE
      );
      const isAppCleared = activeQueueCount === 0 && !hasApproachingNearStopLine;

      const hasCompetingEmergency = competingApps.some((a) =>
        (queuedMap[a] || []).some((v) => v.isEmergency)
      );

      // Requirement 5: If the active approach becomes empty, safely end or shorten its green phase,
      // respecting minimum green and clearance rules. Also expedite clearance if competing emergency vehicle exists.
      if (
        this.config.controllerType === 'ADAPTIVE' &&
        this.phaseElapsedTime >= this.config.adaptiveMinGreen &&
        this.phaseElapsedTime < this.currentPhaseDuration &&
        ((isAppCleared && competingWaitingCount > 0) || hasCompetingEmergency)
      ) {
        const nextPhase = `${activeApp}_YELLOW` as PhaseType;
        const validTransition = SafetyValidator.validatePhaseTransition(this.currentPhase, nextPhase);
        if (validTransition.legal) {
          const actualGreenServed = Math.round(this.phaseElapsedTime * 10) / 10;
          this.currentPhaseDuration = actualGreenServed;
          this.currentPhase = nextPhase;
          this.phaseElapsedTime = 0;
          this.phaseChangeCount++;
          this.addEvent({
            id: `evt-early-term-${this.phaseChangeCount}`,
            timestamp: this.currentTime,
            type: 'PHASE_CHANGE',
            severity: hasCompetingEmergency ? 'alert' : 'info',
            approach: activeApp,
            message: hasCompetingEmergency
              ? `Emergency Preemption Clearance: Approach [${activeApp}] green truncated early (${actualGreenServed}s served) for waiting emergency vehicle. Entering YELLOW clearance.`
              : `Early Green Termination: Approach [${activeApp}] queue cleared (${actualGreenServed}s served). Entering YELLOW clearance (${this.config.yellowDuration}s) to serve ${competingWaitingCount} waiting vehicle(s).`,
          });
          return;
        }
      }

      // Check if green elapsed
      if (this.phaseElapsedTime >= this.currentPhaseDuration) {
        // Check if adaptive controller wants to extend green
        if (this.config.controllerType === 'ADAPTIVE') {
          const extensionDecision = this.controller.shouldExtendCurrentGreen(
            {
              currentTime: this.currentTime,
              currentApproach: activeApp,
              phaseElapsedTime: this.phaseElapsedTime,
              queues: this.getQueuedVehiclesMap(),
              approachingVehicles: this.getApproachingVehiclesMap(),
              arrivalRates: this.config.arrivalRates,
              config: this.config,
            },
            this.currentPhaseDuration
          );

          if (extensionDecision.extend) {
            this.currentPhaseDuration += extensionDecision.additionalTime;
            this.addEvent({
              id: `evt-ext-${Math.floor(this.currentTime * 10)}`,
              timestamp: this.currentTime,
              type: 'CONTROLLER_DECISION',
              severity: 'info',
              approach: activeApp,
              message: extensionDecision.reason,
            });
            return;
          }
        }

        // Green phase ended, transition to yellow
        const nextPhase = `${activeApp}_YELLOW` as PhaseType;
        const validTransition = SafetyValidator.validatePhaseTransition(this.currentPhase, nextPhase);
        if (validTransition.legal) {
          this.currentPhase = nextPhase;
          this.phaseElapsedTime = 0;
          this.phaseChangeCount++;
          this.addEvent({
            id: `evt-phase-${this.phaseChangeCount}`,
            timestamp: this.currentTime,
            type: 'PHASE_CHANGE',
            severity: 'warning',
            approach: activeApp,
            message: `Approach [${activeApp}] green completed (${this.currentPhaseDuration}s). Entering YELLOW clearance (${this.config.yellowDuration}s).`,
          });
        }
      }
    } else if (this.currentPhase.endsWith('_YELLOW')) {
      if (this.phaseElapsedTime >= this.config.yellowDuration) {
        // Yellow clearance ended -> ALL_RED
        this.currentPhase = 'ALL_RED';
        this.phaseElapsedTime = 0;
        this.addEvent({
          id: `evt-allred-${Math.floor(this.currentTime * 10)}`,
          timestamp: this.currentTime,
          type: 'PHASE_CHANGE',
          severity: 'info',
          approach: 'ALL',
          message: `Intersection clearance: ALL_RED interval (${this.config.allRedDuration}s) activated. All signals RED.`,
        });
      }
    } else if (this.currentPhase === 'ALL_RED') {
      if (this.phaseElapsedTime >= this.config.allRedDuration) {
        // Requirement 8: Ensure all vehicles from the previous direction have cleared the intersection
        const isIntersectionOccupied = (['N', 'S', 'E', 'W'] as Approach[]).some((app) =>
          this.vehicles[app].some(
            (v) => (v.state === 'crossing' || v.distance > SimulationEngine.STOP_LINE) &&
                   v.distance > SimulationEngine.STOP_LINE &&
                   v.distance <= SimulationEngine.INTERSECTION_END
          )
        );

        if (isIntersectionOccupied) {
          // Remain in ALL_RED until all clearing vehicles have safely exited the intersection
          return;
        }

        // All-red clearance completed -> Request next decision from controller
        const decision = this.controller.selectNextPhase({
          currentTime: this.currentTime,
          currentApproach: this.lastDecision?.selectedApproach || null,
          phaseElapsedTime: this.phaseElapsedTime,
          queues: this.getQueuedVehiclesMap(),
          approachingVehicles: this.getApproachingVehiclesMap(),
          arrivalRates: this.config.arrivalRates,
          config: this.config,
        });

        this.lastDecision = decision;
        const nextPhase = `${decision.selectedApproach}_GREEN` as PhaseType;
        this.currentPhase = nextPhase;
        this.currentPhaseDuration = decision.allocatedDuration;
        this.phaseElapsedTime = 0;
        this.phaseChangeCount++;

        this.addEvent({
          id: `evt-dec-${decision.id}`,
          timestamp: this.currentTime,
          type: 'CONTROLLER_DECISION',
          severity: decision.emergencyOverride
            ? 'alert'
            : decision.starvationOverride
            ? 'warning'
            : 'success',
          approach: decision.selectedApproach,
          message: decision.rationale,
        });
      }
    }
  }

  private updateVehiclePhysics(dt: number): void {
    const signals = SafetyValidator.getSignalsForPhase(this.currentPhase);
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];

    for (const app of approaches) {
      const laneVehicles = this.vehicles[app];
      const signalState = signals[app];

      for (let i = 0; i < laneVehicles.length; i++) {
        const v = laneVehicles[i];

        // 1. Vehicles already past the stop line inside the intersection must clear safely
        const isInsideIntersection = v.distance > SimulationEngine.STOP_LINE;

        if (isInsideIntersection) {
          v.state = 'crossing';
          v.speed = Math.min(80, v.speed + 40 * dt); // accelerate to clear

          let maxTravel = v.speed * dt;
          if (i > 0) {
            const ahead = laneVehicles[i - 1];
            const maxAllowedDist = ahead.distance - SimulationEngine.VEHICLE_GAP;
            if (maxAllowedDist > v.distance) {
              v.distance = Math.min(maxAllowedDist, v.distance + maxTravel);
            }
          } else {
            v.distance += maxTravel;
          }

          if (!v.departureTime) {
            v.departureTime = this.currentTime;
            this.addEvent({
              id: `evt-dep-${v.id}`,
              timestamp: this.currentTime,
              type: 'VEHICLE_DEPARTED',
              severity: 'success',
              approach: v.approach,
              message: `${v.type.toUpperCase()} #${v.id} cleared stop line at [${v.approach}]. Wait time: ${Math.round(v.waitingTime * 10) / 10}s`,
            });
          }
        } else {
          // 2. Vehicle is before the stop line (v.distance <= STOP_LINE).
          // Determine if vehicle is permitted to enter the intersection.
          let canEnter = false;

          // Requirement 8: Ensure no vehicle from another approach occupies the intersection
          const isIntersectionOccupiedByOther = approaches.some((otherApp) =>
            otherApp !== app &&
            this.vehicles[otherApp].some(
              (pv) => (pv.state === 'crossing' || pv.distance > SimulationEngine.STOP_LINE) &&
                     pv.distance > SimulationEngine.STOP_LINE &&
                     pv.distance <= SimulationEngine.INTERSECTION_END
            )
          );

          let isLeadConflicting = false;
          if (i > 0) {
            const ahead = laneVehicles[i - 1];
            if (
              ahead.movement &&
              v.movement &&
              ahead.movement !== v.movement &&
              ahead.distance <= SimulationEngine.INTERSECTION_END
            ) {
              isLeadConflicting = true;
            }
          }

          if (signalState === 'GREEN') {
            if (isIntersectionOccupiedByOther || isLeadConflicting) {
              canEnter = false;
            } else if (i === 0) {
              canEnter = true;
            } else {
              const ahead = laneVehicles[i - 1];
              // Can proceed if ahead vehicle has opened sufficient following gap
              canEnter = (ahead.distance - v.distance) >= SimulationEngine.VEHICLE_GAP;
            }
          } else if (signalState === 'YELLOW') {
            // Dilemma zone: only vehicles already within 25 units at high speed at the onset of yellow are committed
            const distToStopLine = SimulationEngine.STOP_LINE - v.distance;
            const isCommitted =
              !isIntersectionOccupiedByOther &&
              this.phaseElapsedTime <= dt &&
              distToStopLine <= 25 &&
              v.speed >= 35;
            if (isCommitted) {
              if (i === 0) {
                canEnter = true;
              } else {
                const ahead = laneVehicles[i - 1];
                canEnter = (ahead.distance - v.distance) >= SimulationEngine.VEHICLE_GAP;
              }
            }
          } else {
            // RED or ALL_RED: Strict prohibition. No vehicle before stop line may enter.
            canEnter = false;
          }

          if (canEnter) {
            v.speed = Math.min(80, v.speed + 40 * dt);
            const move = v.speed * dt;

            let targetDist = v.distance + move;
            if (i > 0) {
              const ahead = laneVehicles[i - 1];
              targetDist = Math.min(targetDist, ahead.distance - SimulationEngine.VEHICLE_GAP);
            }

            v.distance = targetDist;

            if (v.distance >= SimulationEngine.STOP_LINE) {
              v.state = 'crossing';
              if (!v.departureTime) {
                v.departureTime = this.currentTime;
                this.addEvent({
                  id: `evt-dep-${v.id}`,
                  timestamp: this.currentTime,
                  type: 'VEHICLE_DEPARTED',
                  severity: 'success',
                  approach: v.approach,
                  message: `${v.type.toUpperCase()} #${v.id} cleared stop line at [${v.approach}]. Wait time: ${Math.round(v.waitingTime * 10) / 10}s`,
                });
              }
            } else {
              v.state = 'approaching';
            }
          } else {
            // 3. Approaching or queued behind stop line
            const leadLimit = SimulationEngine.getLeadStopDistance(v);
            let targetStopDist = leadLimit;
            if (i > 0) {
              const ahead = laneVehicles[i - 1];
              // If vehicle ahead is crossing or has passed the stop line, this vehicle stops at lead position
              if (ahead.state === 'crossing' || ahead.distance > SimulationEngine.STOP_LINE) {
                targetStopDist = leadLimit;
              } else {
                // Ahead vehicle is queued or stopping before stop line
                targetStopDist = Math.min(leadLimit, SimulationEngine.getFollowingStopDistance(v, ahead));
              }
            }

            // Target stop distance can NEVER exceed lead stopping position
            targetStopDist = Math.min(leadLimit, targetStopDist);

            const distanceToStop = targetStopDist - v.distance;

            if (distanceToStop <= 0) {
              // Already at or past target stop distance - remain stationary without jumping backward
              v.speed = 0;
              if (v.state !== 'queued') {
                v.state = 'queued';
                if (v.queueEntryTime === null) {
                  v.queueEntryTime = this.currentTime;
                  this.addEvent({
                    id: `evt-q-${v.id}`,
                    timestamp: this.currentTime,
                    type: 'VEHICLE_QUEUED',
                    severity: 'info',
                    approach: v.approach,
                    message: `${v.type.toUpperCase()} #${v.id} entered queue at [${v.approach}] (Position #${i + 1})`,
                  });
                }
              }
              v.waitingTime += dt;
            } else if (distanceToStop <= 0.2) {
              // Stopped cleanly at queue position
              v.speed = 0;
              v.distance = targetStopDist;
              if (v.state !== 'queued') {
                v.state = 'queued';
                if (v.queueEntryTime === null) {
                  v.queueEntryTime = this.currentTime;
                  this.addEvent({
                    id: `evt-q-${v.id}`,
                    timestamp: this.currentTime,
                    type: 'VEHICLE_QUEUED',
                    severity: 'info',
                    approach: v.approach,
                    message: `${v.type.toUpperCase()} #${v.id} entered queue at [${v.approach}] (Position #${i + 1})`,
                  });
                }
              }
              v.waitingTime += dt;
            } else {
              // Approaching stop position - smooth deceleration
              v.speed = Math.min(60, distanceToStop * 1.8);
              const move = Math.min(distanceToStop, v.speed * dt);
              v.distance += move;

              if (targetStopDist - v.distance <= 0.2) {
                v.speed = 0;
                v.distance = targetStopDist;
                v.state = 'queued';
                if (v.queueEntryTime === null) {
                  v.queueEntryTime = this.currentTime;
                  this.addEvent({
                    id: `evt-q-${v.id}`,
                    timestamp: this.currentTime,
                    type: 'VEHICLE_QUEUED',
                    severity: 'info',
                    approach: v.approach,
                    message: `${v.type.toUpperCase()} #${v.id} entered queue at [${v.approach}] (Position #${i + 1})`,
                  });
                }
                v.waitingTime += dt;
              } else {
                v.state = 'approaching';
              }
            }
          }
        }
      }

      // Check for departed vehicles that crossed exit line
      const activeLane: Vehicle[] = [];
      for (const v of laneVehicles) {
        if (v.distance >= SimulationEngine.EXIT_LINE) {
          v.state = 'departed';
          v.exitTime = this.currentTime;
          this.servedVehicles.push(v);
        } else {
          activeLane.push(v);
        }
      }
      this.vehicles[app] = activeLane;
    }
  }

  private addEvent(event: SimulationEvent): void {
    this.events.unshift(event);
    if (this.events.length > this.maxEventHistory) {
      this.events.pop();
    }
  }

  // Helpers
  getQueuedVehiclesMap(): Record<Approach, Vehicle[]> {
    return {
      N: this.vehicles.N.filter((v) => v.state === 'queued'),
      S: this.vehicles.S.filter((v) => v.state === 'queued'),
      E: this.vehicles.E.filter((v) => v.state === 'queued'),
      W: this.vehicles.W.filter((v) => v.state === 'queued'),
    };
  }

  getApproachingVehiclesMap(): Record<Approach, Vehicle[]> {
    return {
      N: this.vehicles.N.filter((v) => v.state === 'approaching'),
      S: this.vehicles.S.filter((v) => v.state === 'approaching'),
      E: this.vehicles.E.filter((v) => v.state === 'approaching'),
      W: this.vehicles.W.filter((v) => v.state === 'approaching'),
    };
  }

  getMetrics(): SimulationMetrics {
    const queuedMap = this.getQueuedVehiclesMap();
    const approachQueues: Record<Approach, number> = {
      N: queuedMap.N.length,
      S: queuedMap.S.length,
      E: queuedMap.E.length,
      W: queuedMap.W.length,
    };

    const approachServed: Record<Approach, number> = { N: 0, S: 0, E: 0, W: 0 };
    const approachWaitTimes: Record<Approach, number[]> = { N: [], S: [], E: [], W: [] };
    const allWaitTimes: number[] = [];

    // Collect wait times from served vehicles
    for (const v of this.servedVehicles) {
      approachServed[v.approach]++;
      approachWaitTimes[v.approach].push(v.waitingTime);
      allWaitTimes.push(v.waitingTime);
    }

    // Also include currently queued wait times for up-to-the-second accuracy
    for (const app of ['N', 'S', 'E', 'W'] as Approach[]) {
      for (const v of queuedMap[app]) {
        approachWaitTimes[app].push(v.waitingTime);
        allWaitTimes.push(v.waitingTime);
      }
    }

    allWaitTimes.sort((a, b) => a - b);

    const totalQueued =
      approachQueues.N + approachQueues.S + approachQueues.E + approachQueues.W;
    const totalServed = this.servedVehicles.length;

    const avgWait =
      allWaitTimes.length > 0
        ? allWaitTimes.reduce((a, b) => a + b, 0) / allWaitTimes.length
        : 0;

    const medianWait =
      allWaitTimes.length > 0
        ? allWaitTimes[Math.floor(allWaitTimes.length / 2)]
        : 0;

    const p95Wait =
      allWaitTimes.length > 0
        ? allWaitTimes[Math.floor(allWaitTimes.length * 0.95)]
        : 0;

    const maxWait =
      allWaitTimes.length > 0 ? allWaitTimes[allWaitTimes.length - 1] : 0;

    const simMinutes = Math.max(0.01, this.currentTime / 60);
    const throughput = totalServed / simMinutes;

    return {
      simulationTime: Math.round(this.currentTime * 10) / 10,
      totalGenerated: this.allGeneratedCount,
      totalServed,
      currentQueued: totalQueued,
      approachQueues,
      approachServed,
      approachWaitTimes,
      avgWaitingTime: Math.round(avgWait * 10) / 10,
      medianWaitingTime: Math.round(medianWait * 10) / 10,
      p95WaitingTime: Math.round(p95Wait * 10) / 10,
      maxWaitingTime: Math.round(maxWait * 10) / 10,
      throughputPerMin: Math.round(throughput * 10) / 10,
      phaseChangeCount: this.phaseChangeCount,
      remainingQueue: totalQueued,
    };
  }

  getSignalStatuses(): Record<Approach, SignalStatus> {
    const signals = SafetyValidator.getSignalsForPhase(this.currentPhase);
    const remaining = Math.max(
      0,
      Math.round(
        (this.currentPhase.endsWith('_GREEN')
          ? this.currentPhaseDuration
          : this.currentPhase.endsWith('_YELLOW')
          ? this.config.yellowDuration
          : this.config.allRedDuration) - this.phaseElapsedTime
      )
    );

    return {
      N: { approach: 'N', state: signals.N, remainingTime: remaining },
      S: { approach: 'S', state: signals.S, remainingTime: remaining },
      E: { approach: 'E', state: signals.E, remainingTime: remaining },
      W: { approach: 'W', state: signals.W, remainingTime: remaining },
    };
  }

  // Getters & State controls
  getCurrentTime(): number {
    return this.currentTime;
  }

  getCurrentPhase(): PhaseType {
    return this.currentPhase;
  }

  getPhaseElapsedTime(): number {
    return this.phaseElapsedTime;
  }

  getCurrentPhaseDuration(): number {
    return this.currentPhaseDuration;
  }

  getLastDecision(): ControllerDecision | null {
    return this.lastDecision;
  }

  getVehicles(): Record<Approach, Vehicle[]> {
    return this.vehicles;
  }

  getEvents(): SimulationEvent[] {
    return this.events;
  }

  getConfig(): SimulationConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.controllerType && newConfig.controllerType !== this.controller.type) {
      this.controller =
        newConfig.controllerType === 'ADAPTIVE'
          ? new AdaptiveController()
          : new FixedTimeController();
    }
  }

  setControllerType(type: 'FIXED' | 'ADAPTIVE'): void {
    if (this.config.controllerType !== type) {
      this.config.controllerType = type;
      this.controller =
        type === 'ADAPTIVE' ? new AdaptiveController() : new FixedTimeController();
      this.addEvent({
        id: `evt-mode-${Date.now()}`,
        timestamp: this.currentTime,
        type: 'CONTROLLER_DECISION',
        severity: 'info',
        approach: 'ALL',
        message: `Controller mode switched to ${type}`,
      });
    }
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  getSpeed(): number {
    return this.speedMultiplier;
  }

  play(): void {
    this.isRunning = true;
  }

  pause(): void {
    this.isRunning = false;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  reset(newSeed?: number): void {
    if (newSeed !== undefined) {
      this.config.seed = newSeed;
    }
    this.currentTime = 0;
    this.isRunning = false;
    this.vehicles = { N: [], S: [], E: [], W: [] };
    this.servedVehicles = [];
    this.allGeneratedCount = 0;
    this.phaseChangeCount = 0;
    this.events = [];
    this.generator.reset(this.config.seed);
    if ('reset' in this.controller) {
      (this.controller as any).reset();
    }
    this.initializeFirstPhase();
  }
}
