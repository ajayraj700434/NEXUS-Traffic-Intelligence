export type Approach = 'N' | 'S' | 'E' | 'W';

export type TrafficAxis = 'NS' | 'EW' | 'NS_LEFT' | 'EW_LEFT';

export type MovementType = 'STRAIGHT' | 'LEFT' | 'RIGHT';

export type MovementKey = `${Approach}_${MovementType}`;

export type SignalState = 'RED' | 'YELLOW' | 'GREEN';

export type VehicleType = 'car' | 'bus' | 'truck' | 'emergency';

export type VehicleState = 'approaching' | 'queued' | 'crossing' | 'departed';

export interface Vehicle {
  id: string;
  approach: Approach;
  type: VehicleType;
  movement?: MovementType; // defaults to 'STRAIGHT' if unspecified
  targetApproach?: Approach; // Outbound departure approach
  arrivalTime: number; // Sim seconds
  queueEntryTime: number | null; // Sim seconds
  departureTime: number | null; // Sim seconds
  exitTime: number | null;
  state: VehicleState;
  distance: number; // 0 (far away) to 180 (stop line) to 260+ (exited)
  speed: number; // px per sim second
  waitingTime: number; // Sim seconds spent stationary in queue
  color: string;
  isEmergency?: boolean;
}

export type PhaseType = 
  | 'NS_GREEN' | 'NS_YELLOW'
  | 'EW_GREEN' | 'EW_YELLOW'
  | 'NS_LEFT_GREEN' | 'NS_LEFT_YELLOW'
  | 'EW_LEFT_GREEN' | 'EW_LEFT_YELLOW'
  | 'ALL_RED'
  | 'N_GREEN' | 'N_YELLOW'
  | 'S_GREEN' | 'S_YELLOW'
  | 'E_GREEN' | 'E_YELLOW'
  | 'W_GREEN' | 'W_YELLOW';

export interface SignalStatus {
  approach: Approach;
  state: SignalState;
  remainingTime: number;
  leftTurnState?: SignalState;
}

export type ControllerType = 'FIXED' | 'ADAPTIVE';

export interface ApproachArrivalRates {
  N: number; // vehicles per minute
  S: number;
  E: number;
  W: number;
}

export interface SimulationConfig {
  seed: number;
  controllerType: ControllerType;
  simulationDuration: number; // default 300s
  fixedGreenDuration: number; // default 25s
  adaptiveMinGreen: number; // default 10s
  adaptiveMaxGreen: number; // default 45s
  yellowDuration: number; // default 3s
  allRedDuration: number; // default 1s
  queueWeight: number; // W_q
  waitWeight: number; // W_w
  arrivalRateWeight: number; // W_a
  starvationThreshold: number; // seconds
  emergencyPriorityBoost: number;
  arrivalRates: ApproachArrivalRates;
}

export interface ControllerScoreBreakdown {
  approach: Approach | TrafficAxis;
  queueCount: number;
  maxWait: number;
  avgWait: number;
  arrivalRate: number;
  hasEmergency: boolean;
  isStarving: boolean;
  rawScore: number;
}

export interface ControllerDecision {
  id: string;
  timestamp: number;
  selectedApproach: Approach | TrafficAxis;
  previousApproach: Approach | TrafficAxis | null;
  allocatedDuration: number;
  scores: Record<string, ControllerScoreBreakdown>;
  rationale: string;
  starvationOverride: boolean;
  emergencyOverride: boolean;
  selectedAxis?: TrafficAxis;
}

export type EventSeverity = 'info' | 'success' | 'warning' | 'alert';

export type EventType =
  | 'VEHICLE_ARRIVED'
  | 'VEHICLE_QUEUED'
  | 'PHASE_CHANGE'
  | 'CONTROLLER_DECISION'
  | 'VEHICLE_DEPARTED'
  | 'STARVATION_ALERT'
  | 'EMERGENCY_OVERRIDE'
  | 'SYSTEM_RESET';

export interface SimulationEvent {
  id: string;
  timestamp: number;
  type: EventType;
  severity: EventSeverity;
  approach: Approach | TrafficAxis | 'ALL';
  message: string;
  details?: Record<string, string | number | boolean>;
}

export interface SimulationMetrics {
  simulationTime: number;
  totalGenerated: number;
  totalServed: number;
  currentQueued: number;
  approachQueues: Record<Approach, number>;
  approachServed: Record<Approach, number>;
  approachWaitTimes: Record<Approach, number[]>;
  avgWaitingTime: number;
  medianWaitingTime: number;
  p95WaitingTime: number;
  maxWaitingTime: number;
  throughputPerMin: number;
  phaseChangeCount: number;
  remainingQueue: number;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  config: Partial<SimulationConfig>;
}

export interface ComparisonTimelinePoint {
  time: number;
  queueFixed: number;
  queueAdaptive: number;
  avgWaitFixed: number;
  avgWaitAdaptive: number;
  servedFixed: number;
  servedAdaptive: number;
}

export interface ComparisonReport {
  scenarioName: string;
  horizon: number;
  seed: number;
  fixed: SimulationMetrics;
  adaptive: SimulationMetrics;
  timeline: ComparisonTimelinePoint[];
  deltas: {
    avgWaitPercent: number;
    maxWaitPercent: number;
    throughputPercent: number;
    servedPercent: number;
    queuePercent: number;
  };
  interpretation: string;
}
