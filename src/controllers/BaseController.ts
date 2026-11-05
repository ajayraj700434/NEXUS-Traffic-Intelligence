import { Approach, ControllerDecision, ControllerType, SimulationConfig, TrafficAxis, Vehicle } from '../types';

export interface ControllerContext {
  currentTime: number;
  currentApproach: Approach | TrafficAxis | null;
  phaseElapsedTime: number;
  queues: Record<Approach, Vehicle[]>;
  approachingVehicles?: Record<Approach, Vehicle[]>;
  arrivalRates: Record<Approach, number>;
  config: SimulationConfig;
}

export abstract class BaseController {
  abstract type: ControllerType;
  abstract selectNextPhase(context: ControllerContext): ControllerDecision;
  abstract shouldExtendCurrentGreen(context: ControllerContext, currentAllocated: number): { extend: boolean; additionalTime: number; reason: string };
}
