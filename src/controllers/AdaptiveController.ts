import { Approach, ControllerDecision, ControllerScoreBreakdown, ControllerType } from '../types';
import { BaseController, ControllerContext } from './BaseController';

export class AdaptiveController extends BaseController {
  type: ControllerType = 'ADAPTIVE';
  private decisionCounter: number = 0;

  selectNextPhase(context: ControllerContext): ControllerDecision {
    this.decisionCounter++;
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];

    // 1. Calculate individual approach statistics
    const approachScores: Record<Approach, ControllerScoreBreakdown> = {} as Record<Approach, ControllerScoreBreakdown>;
    const totalWaitingAcrossAll = approaches.reduce(
      (sum, a) => sum + (context.queues[a]?.length || 0),
      0
    );

    for (const app of approaches) {
      const q = context.queues[app] || [];
      const waitTimes = q.map((v) =>
        v.waitingTime > 0 ? v.waitingTime : Math.max(0, context.currentTime - (v.queueEntryTime ?? v.arrivalTime))
      );
      const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;
      const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
      const arrivalRate = context.arrivalRates[app] || 0;
      const hasEmergency = q.some((v) => v.isEmergency);
      const isStarving = q.length > 0 && maxWait >= context.config.starvationThreshold;

      let score =
        q.length * context.config.queueWeight +
        avgWait * context.config.waitWeight +
        (arrivalRate / 10) * context.config.arrivalRateWeight;

      if (hasEmergency) {
        score += context.config.emergencyPriorityBoost;
      } else if (isStarving) {
        score += 200 + (maxWait - context.config.starvationThreshold) * 2;
      }

      // Do not grant green to an empty approach when other approaches have queued vehicles
      if (totalWaitingAcrossAll > 0 && q.length === 0) {
        score = -Infinity;
      }

      approachScores[app] = {
        approach: app,
        queueCount: q.length,
        maxWait: Math.round(maxWait * 10) / 10,
        avgWait: Math.round(avgWait * 10) / 10,
        arrivalRate,
        hasEmergency,
        isStarving,
        rawScore: score === -Infinity ? -999 : Math.round(score * 100) / 100,
      };
    }

    // 2. Candidate ordering for deterministic idle rotation and tie-breaking
    const idleSequence: Approach[] = ['N', 'S', 'E', 'W'];
    let orderedApproaches: Approach[];

    const prevApp = context.currentApproach as Approach | null;
    if (prevApp && idleSequence.includes(prevApp)) {
      const idx = idleSequence.indexOf(prevApp);
      orderedApproaches = [
        ...idleSequence.slice(idx + 1),
        ...idleSequence.slice(0, idx + 1),
      ];
    } else {
      orderedApproaches = [...idleSequence];
    }

    let highestScore = -Infinity;
    let chosenApproach: Approach = orderedApproaches[0];

    for (const app of orderedApproaches) {
      const s = approachScores[app].rawScore;
      if (s > highestScore) {
        highestScore = s;
        chosenApproach = app;
      }
    }

    const chosenStats = approachScores[chosenApproach];
    const emergencyOverride = chosenStats.hasEmergency;
    const starvationOverride = chosenStats.isStarving && !emergencyOverride;

    // 3. Calculate dynamically proposed green duration within [minGreen, maxGreen]
    const minG = context.config.adaptiveMinGreen;
    const maxG = context.config.adaptiveMaxGreen;

    let allocatedDuration: number;
    if (totalWaitingAcrossAll === 0) {
      allocatedDuration = minG;
    } else {
      const queueFactor =
        chosenStats.queueCount <= 1
          ? 0
          : Math.min(1, Math.max(0, (chosenStats.queueCount - 1) / 10));
      const calculatedDuration = Math.round(minG + queueFactor * (maxG - minG));
      allocatedDuration = Math.min(maxG, Math.max(minG, calculatedDuration));
    }

    // 4. Construct detailed explainability rationale
    let rationale = '';
    if (emergencyOverride) {
      rationale = `EMERGENCY VEHICLE CLEARANCE: Approach [${chosenApproach}] has priority emergency vehicle detected. Preempted normal cycle with ${allocatedDuration}s green. The other three directions remain RED.`;
    } else if (starvationOverride) {
      rationale = `STARVATION OVERRIDE: Approach [${chosenApproach}] selected because queued vehicle exceeded ${context.config.starvationThreshold}s limit (waiting ${chosenStats.maxWait}s). Priority boosted (Score: ${chosenStats.rawScore}). Allocated ${allocatedDuration}s green.`;
    } else if (chosenStats.queueCount > 0) {
      rationale = `Adaptive Single-Approach Policy: Approach [${chosenApproach}] selected with highest weighted pressure score of ${chosenStats.rawScore}. Queue: ${chosenStats.queueCount} vehicles, avg wait: ${chosenStats.avgWait}s. Allocated ${allocatedDuration}s green. The other 3 approaches remain RED.`;
    } else {
      rationale = `Adaptive Idle Rotation: All queues empty. Approach [${chosenApproach}] selected on deterministic schedule with minimal ${minG}s green.`;
    }

    return {
      id: `adapt-dec-${this.decisionCounter}-${Math.floor(context.currentTime)}`,
      timestamp: context.currentTime,
      selectedApproach: chosenApproach,
      previousApproach: prevApp,
      allocatedDuration,
      scores: approachScores,
      rationale,
      starvationOverride,
      emergencyOverride,
    };
  }

  shouldExtendCurrentGreen(
    context: ControllerContext,
    currentAllocated: number
  ): { extend: boolean; additionalTime: number; reason: string } {
    if (!context.currentApproach) {
      return { extend: false, additionalTime: 0, reason: 'No active phase.' };
    }

    const activeApp = (context.currentApproach as string).split('_')[0] as Approach;
    const competingApps: Approach[] = (['N', 'S', 'E', 'W'] as Approach[]).filter((a) => a !== activeApp);
    const maxG = context.config.adaptiveMaxGreen;

    // Check if max green limit reached
    if (context.phaseElapsedTime >= maxG) {
      return {
        extend: false,
        additionalTime: 0,
        reason: `Maximum green duration of ${maxG}s reached for approach [${activeApp}]. Clearance forced.`,
      };
    }

    // Check if competing approaches have emergency vehicles or are starving
    for (const app of competingApps) {
      const q = context.queues[app] || [];
      const hasEmergency = q.some((v) => v.isEmergency);
      if (hasEmergency) {
        return {
          extend: false,
          additionalTime: 0,
          reason: `Competing approach [${app}] has emergency vehicle waiting. Extension denied.`,
        };
      }
      const waitTimes = q.map((v) =>
        v.waitingTime > 0 ? v.waitingTime : Math.max(0, context.currentTime - (v.queueEntryTime ?? v.arrivalTime))
      );
      const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;
      const isStarving = q.length > 0 && maxWait >= context.config.starvationThreshold;
      if (isStarving) {
        return {
          extend: false,
          additionalTime: 0,
          reason: `Competing approach [${app}] is starving (wait: ${Math.round(maxWait)}s). Extension denied.`,
        };
      }
    }

    // Active approach demand check
    const activeQueuedCount = context.queues[activeApp]?.length || 0;
    const activeApproachingCount = (context.approachingVehicles?.[activeApp] || []).filter(
      (v) => v.distance >= 120 && v.distance < 180
    ).length;

    const hasDemand = activeQueuedCount > 0 || activeApproachingCount > 0;

    if (hasDemand && currentAllocated < maxG) {
      const extension = Math.min(5, maxG - currentAllocated);
      if (extension > 0) {
        const detail =
          activeQueuedCount > 0
            ? `${activeQueuedCount} queued vehicle(s)`
            : `${activeApproachingCount} newly arrived vehicle(s) approaching stop line`;
        return {
          extend: true,
          additionalTime: extension,
          reason: `Approach [${activeApp}] has ${detail}. Extended green by +${extension}s (up to ${maxG}s max).`,
        };
      }
    }

    return {
      extend: false,
      additionalTime: 0,
      reason: `Queue cleared and no arriving demand for approach [${activeApp}]. Proceeding to clearance.`,
    };
  }
}
