import { Approach, ControllerDecision, ControllerScoreBreakdown, ControllerType } from '../types';
import { BaseController, ControllerContext } from './BaseController';

export class FixedTimeController extends BaseController {
  type: ControllerType = 'FIXED';
  private sequence: Approach[];
  private currentIndex: number = 0;
  private decisionCounter: number = 0;

  constructor(startingApproachIndex: number = 0, customSequence?: Approach[]) {
    super();
    this.sequence = customSequence && customSequence.length > 0 ? customSequence : ['N', 'S', 'E', 'W'];
    this.currentIndex = startingApproachIndex % this.sequence.length;
  }

  selectNextPhase(context: ControllerContext): ControllerDecision {
    const selected = this.sequence[this.currentIndex];
    const prevApproach = (context.currentApproach as Approach | null) || null;
    this.currentIndex = (this.currentIndex + 1) % this.sequence.length;
    this.decisionCounter++;

    const scores: Record<string, ControllerScoreBreakdown> = {
      N: this.createEmptyScore('N', context),
      S: this.createEmptyScore('S', context),
      E: this.createEmptyScore('E', context),
      W: this.createEmptyScore('W', context),
    };

    const duration = Math.max(5, context.config.fixedGreenDuration);
    const queueLen = scores[selected]?.queueCount || 0;

    const rationale = `Fixed-Time Schedule: Sequence index #${this.decisionCounter} advanced to [${selected}] approach. Allocated constant ${duration}s green phase to direction [${selected}]. The other three directions remain RED (${queueLen} vehicles waiting on [${selected}]).`;

    return {
      id: `fixed-dec-${this.decisionCounter}-${Math.floor(context.currentTime)}`,
      timestamp: context.currentTime,
      selectedApproach: selected,
      previousApproach: prevApproach,
      allocatedDuration: duration,
      scores,
      rationale,
      starvationOverride: false,
      emergencyOverride: false,
    };
  }

  shouldExtendCurrentGreen(): { extend: boolean; additionalTime: number; reason: string } {
    return {
      extend: false,
      additionalTime: 0,
      reason: 'Fixed controller uses strict static durations without dynamic extensions.',
    };
  }

  reset(startIndex: number = 0): void {
    this.currentIndex = startIndex % this.sequence.length;
    this.decisionCounter = 0;
  }

  private createEmptyScore(approach: Approach, context: ControllerContext): ControllerScoreBreakdown {
    const q = context.queues[approach] || [];
    const waitTimes = q.map((v) => context.currentTime - (v.queueEntryTime ?? v.arrivalTime));
    const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;
    const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

    return {
      approach,
      queueCount: q.length,
      maxWait: Math.round(maxWait * 10) / 10,
      avgWait: Math.round(avgWait * 10) / 10,
      arrivalRate: context.arrivalRates[approach] || 0,
      hasEmergency: q.some((v) => v.isEmergency),
      isStarving: q.length > 0 && maxWait >= context.config.starvationThreshold,
      rawScore: 0,
    };
  }
}
