import { ComparisonReport, ComparisonTimelinePoint, SimulationConfig, SimulationMetrics } from '../types';
import { SimulationEngine } from '../simulation/SimulationEngine';

export class ComparisonRunner {
  /**
   * Executes a deterministic side-by-side simulation experiment comparing
   * Fixed-Time and Adaptive controllers over the exact same traffic horizon.
   */
  static runExperiment(
    baseConfig: SimulationConfig,
    scenarioName: string = 'Custom Scenario',
    onProgress?: (progress: number) => void
  ): ComparisonReport {
    const horizon = baseConfig.simulationDuration;
    const dt = 0.5; // step size in seconds
    const totalSteps = Math.ceil(horizon / dt);
    const sampleInterval = Math.max(1, Math.floor(totalSteps / 60)); // ~60 data points for charts

    // Setup Engine A: Fixed Time
    const fixedConfig: SimulationConfig = {
      ...baseConfig,
      controllerType: 'FIXED',
    };
    const engineFixed = new SimulationEngine(fixedConfig);

    // Setup Engine B: Adaptive Controller
    const adaptiveConfig: SimulationConfig = {
      ...baseConfig,
      controllerType: 'ADAPTIVE',
    };
    const engineAdaptive = new SimulationEngine(adaptiveConfig);

    const timeline: ComparisonTimelinePoint[] = [];

    for (let step = 0; step < totalSteps; step++) {
      engineFixed.step(dt);
      engineAdaptive.step(dt);

      if (step % sampleInterval === 0 || step === totalSteps - 1) {
        const mFixed = engineFixed.getMetrics();
        const mAdaptive = engineAdaptive.getMetrics();

        timeline.push({
          time: Math.round(step * dt),
          queueFixed: mFixed.currentQueued,
          queueAdaptive: mAdaptive.currentQueued,
          avgWaitFixed: mFixed.avgWaitingTime,
          avgWaitAdaptive: mAdaptive.avgWaitingTime,
          servedFixed: mFixed.totalServed,
          servedAdaptive: mAdaptive.totalServed,
        });

        if (onProgress) {
          onProgress(Math.round(((step + 1) / totalSteps) * 100));
        }
      }
    }

    const fixedMetrics: SimulationMetrics = engineFixed.getMetrics();
    const adaptiveMetrics: SimulationMetrics = engineAdaptive.getMetrics();

    // Calculate empirical delta percentages
    const calcDelta = (fixedVal: number, adaptVal: number): number => {
      if (fixedVal === 0) return adaptVal === 0 ? 0 : 100;
      return Math.round(((adaptVal - fixedVal) / fixedVal) * 1000) / 10;
    };

    const avgWaitPercent = calcDelta(fixedMetrics.avgWaitingTime, adaptiveMetrics.avgWaitingTime);
    const maxWaitPercent = calcDelta(fixedMetrics.maxWaitingTime, adaptiveMetrics.maxWaitingTime);
    const throughputPercent = calcDelta(fixedMetrics.throughputPerMin, adaptiveMetrics.throughputPerMin);
    const servedPercent = calcDelta(fixedMetrics.totalServed, adaptiveMetrics.totalServed);
    const queuePercent = calcDelta(fixedMetrics.remainingQueue, adaptiveMetrics.remainingQueue);

    // Auto-generate interpretation based on measured differences
    let interpretation = '';
    if (avgWaitPercent < -5) {
      const throughputText =
        throughputPercent > 0
          ? `increasing vehicle throughput by +${throughputPercent}% (${fixedMetrics.totalServed} -> ${adaptiveMetrics.totalServed} served)`
          : throughputPercent < 0
          ? `with vehicle throughput changing by ${throughputPercent}% (${fixedMetrics.totalServed} -> ${adaptiveMetrics.totalServed} served)`
          : `with identical vehicle throughput (${fixedMetrics.totalServed} served)`;

      const queueText =
        queuePercent < 0
          ? `and reducing remaining queue by ${Math.abs(queuePercent)}% (${fixedMetrics.remainingQueue} -> ${adaptiveMetrics.remainingQueue})`
          : queuePercent > 0
          ? `while leaving a larger residual queue of ${adaptiveMetrics.remainingQueue} vs ${fixedMetrics.remainingQueue} (+${queuePercent}%) due to clearance interval overhead`
          : `with identical residual queue (${fixedMetrics.remainingQueue})`;

      interpretation = `Adaptive controller reduced average queue waiting time by ${Math.abs(avgWaitPercent)}% (${fixedMetrics.avgWaitingTime}s -> ${adaptiveMetrics.avgWaitingTime}s) ${throughputText}, ${queueText}. Adaptive duration sizing responded to directional demand variations.`;
    } else if (avgWaitPercent > 5) {
      const throughputText =
        throughputPercent > 0
          ? `with throughput changing by +${throughputPercent}% (${fixedMetrics.totalServed} -> ${adaptiveMetrics.totalServed} served)`
          : throughputPercent < 0
          ? `reducing vehicle throughput by ${Math.abs(throughputPercent)}% (${fixedMetrics.totalServed} -> ${adaptiveMetrics.totalServed} served)`
          : `with identical throughput (${fixedMetrics.totalServed} served)`;

      interpretation = `Fixed-time controller demonstrated lower average waiting time in this scenario (Adaptive wait was ${avgWaitPercent}% higher: ${fixedMetrics.avgWaitingTime}s vs ${adaptiveMetrics.avgWaitingTime}s), ${throughputText}. Adaptive controller incurred clearance overhead (yellow + all-red intervals) reacting to short vehicle bursts.`;
    } else {
      const throughputText =
        throughputPercent > 0
          ? `throughput: +${throughputPercent}% (${fixedMetrics.totalServed} vs ${adaptiveMetrics.totalServed})`
          : throughputPercent < 0
          ? `throughput: ${throughputPercent}% (${fixedMetrics.totalServed} vs ${adaptiveMetrics.totalServed})`
          : `throughput: equal (${fixedMetrics.totalServed} served)`;

      interpretation = `Both controllers demonstrated closely comparable waiting times (difference within ${Math.abs(avgWaitPercent)}%: ${fixedMetrics.avgWaitingTime}s vs ${adaptiveMetrics.avgWaitingTime}s, ${throughputText}). Fixed-time is well-suited for uniformly balanced loads, while Adaptive controller adjusted green durations to fluctuating arrival patterns.`;
    }

    return {
      scenarioName,
      horizon,
      seed: baseConfig.seed,
      fixed: fixedMetrics,
      adaptive: adaptiveMetrics,
      timeline,
      deltas: {
        avgWaitPercent,
        maxWaitPercent,
        throughputPercent,
        servedPercent,
        queuePercent,
      },
      interpretation,
    };
  }
}
