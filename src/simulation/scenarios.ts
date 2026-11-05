import { ScenarioPreset, SimulationConfig } from '../types';

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  controllerType: 'ADAPTIVE',
  simulationDuration: 300, // 5 minutes simulation
  fixedGreenDuration: 25,
  adaptiveMinGreen: 10,
  adaptiveMaxGreen: 45,
  yellowDuration: 3,
  allRedDuration: 1,
  queueWeight: 1.5,
  waitWeight: 1.2,
  arrivalRateWeight: 0.8,
  starvationThreshold: 50,
  emergencyPriorityBoost: 1000,
  arrivalRates: {
    N: 14,
    S: 14,
    E: 14,
    W: 14,
  },
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'balanced-city',
    name: 'Balanced City Traffic',
    badge: 'Baseline',
    description: 'Equally distributed moderate traffic across all four approaches (14 veh/min each). Standard baseline scenario.',
    config: {
      seed: 42,
      arrivalRates: { N: 14, S: 14, E: 14, W: 14 },
      fixedGreenDuration: 25,
      adaptiveMinGreen: 10,
      adaptiveMaxGreen: 40,
    },
  },
  {
    id: 'morning-rush',
    name: 'Morning Arterial Inbound',
    badge: 'Heavy North-South',
    description: 'Simulates morning rush hour commuter traffic into downtown with heavy North (30 veh/min) and South (24 veh/min) flows, while East/West cross-streets remain light (8 veh/min).',
    config: {
      seed: 101,
      arrivalRates: { N: 30, S: 24, E: 8, W: 8 },
      fixedGreenDuration: 25,
      adaptiveMinGreen: 10,
      adaptiveMaxGreen: 50,
      starvationThreshold: 45,
    },
  },
  {
    id: 'evening-rush',
    name: 'Evening Outbound Commute',
    badge: 'Heavy East-West',
    description: 'Evening rush hour with high volume exiting east-west highway ramps (East: 28 veh/min, West: 26 veh/min) versus local north-south streets (7 veh/min).',
    config: {
      seed: 202,
      arrivalRates: { N: 7, S: 7, E: 28, W: 26 },
      fixedGreenDuration: 25,
      adaptiveMinGreen: 10,
      adaptiveMaxGreen: 50,
    },
  },
  {
    id: 'north-spike',
    name: 'Northbound Bottleneck Spike',
    badge: 'Asymmetric Shock',
    description: 'Severe asymmetric congestion surge on North approach (36 veh/min) with normal traffic on others (10 veh/min). Tests adaptive response to localized queue explosion.',
    config: {
      seed: 303,
      arrivalRates: { N: 36, S: 10, E: 10, W: 10 },
      fixedGreenDuration: 20,
      adaptiveMinGreen: 10,
      adaptiveMaxGreen: 55,
      starvationThreshold: 40,
    },
  },
  {
    id: 'stress-test',
    name: 'Randomized Stress Test',
    badge: 'Stochastic Burst',
    description: 'High-density burst traffic across all intersections (22-28 veh/min) testing maximum throughput, starvation avoidance, and phase safety under continuous pressure.',
    config: {
      seed: 777,
      arrivalRates: { N: 24, S: 26, E: 28, W: 22 },
      fixedGreenDuration: 30,
      adaptiveMinGreen: 12,
      adaptiveMaxGreen: 60,
      starvationThreshold: 50,
    },
  },
  {
    id: 'emergency-demo',
    name: 'Emergency Priority Preemption',
    badge: 'Priority Preempt',
    description: 'Simulates priority preemption where emergency response vehicles on specific approaches trigger instant score escalation and signal prioritization.',
    config: {
      seed: 999,
      arrivalRates: { N: 16, S: 16, E: 12, W: 12 },
      emergencyPriorityBoost: 1200,
      fixedGreenDuration: 25,
      adaptiveMinGreen: 10,
      adaptiveMaxGreen: 45,
    },
  },
];
