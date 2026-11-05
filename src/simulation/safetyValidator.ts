import { Approach, PhaseType, SignalState } from '../types';

export interface SignalVector {
  N: SignalState;
  S: SignalState;
  E: SignalState;
  W: SignalState;
}

export class SafetyValidator {
  /**
   * Derive individual approach signal states strictly from PhaseType.
   * STRICT INVARIANT: Exactly ONE approach has GREEN (or YELLOW during clearance).
   * The other THREE approaches are strictly RED.
   */
  static getSignalsForPhase(phase: PhaseType): SignalVector {
    const signals: SignalVector = {
      N: 'RED',
      S: 'RED',
      E: 'RED',
      W: 'RED',
    };

    switch (phase) {
      case 'N_GREEN':
        signals.N = 'GREEN';
        break;
      case 'N_YELLOW':
        signals.N = 'YELLOW';
        break;
      case 'S_GREEN':
        signals.S = 'GREEN';
        break;
      case 'S_YELLOW':
        signals.S = 'YELLOW';
        break;
      case 'E_GREEN':
        signals.E = 'GREEN';
        break;
      case 'E_YELLOW':
        signals.E = 'YELLOW';
        break;
      case 'W_GREEN':
        signals.W = 'GREEN';
        break;
      case 'W_YELLOW':
        signals.W = 'YELLOW';
        break;
      case 'ALL_RED':
        // All four signals strictly RED
        break;
      // Defensive fallback for legacy two-axis identifiers
      case 'NS_GREEN':
        signals.N = 'GREEN';
        break;
      case 'NS_YELLOW':
        signals.N = 'YELLOW';
        break;
      case 'EW_GREEN':
        signals.E = 'GREEN';
        break;
      case 'EW_YELLOW':
        signals.E = 'YELLOW';
        break;
    }

    return signals;
  }

  /**
   * STRICT REQUIREMENT: Only ONE traffic signal can be GREEN at any given time.
   * 1. There are four approaches: North, South, East and West.
   * 2. At any moment, at most ONE approach may have a GREEN signal.
   * 3. The other THREE approaches must always remain RED.
   * 4. Never allow North and South to be GREEN simultaneously.
   * 5. Never allow East and West to be GREEN simultaneously.
   * 6. Never allow two or more signals to be GREEN at the same time.
   */
  static validateNoConflictingGreens(signals: SignalVector): { safe: boolean; reason?: string } {
    const approaches: Approach[] = ['N', 'S', 'E', 'W'];
    const greenApproaches = approaches.filter((app) => signals[app] === 'GREEN');
    const yellowApproaches = approaches.filter((app) => signals[app] === 'YELLOW');

    // Requirement 4: Never allow North and South to be GREEN simultaneously
    if (signals.N === 'GREEN' && signals.S === 'GREEN') {
      return {
        safe: false,
        reason: 'CRITICAL SAFETY VIOLATION: Simultaneous North and South GREEN signals detected. Strictly prohibited.',
      };
    }

    // Requirement 5: Never allow East and West to be GREEN simultaneously
    if (signals.E === 'GREEN' && signals.W === 'GREEN') {
      return {
        safe: false,
        reason: 'CRITICAL SAFETY VIOLATION: Simultaneous East and West GREEN signals detected. Strictly prohibited.',
      };
    }

    // Requirement 2, 3 & 6: Never allow two or more signals to be GREEN at the same time
    if (greenApproaches.length > 1) {
      return {
        safe: false,
        reason: `CRITICAL SAFETY VIOLATION: Multiple simultaneous GREEN signals detected on [${greenApproaches.join(', ')}]. Exactly ONE signal may be GREEN at any given time.`,
      };
    }

    // Never allow simultaneous GREEN and YELLOW across approaches
    if (greenApproaches.length > 0 && yellowApproaches.length > 0) {
      return {
        safe: false,
        reason: `CRITICAL SAFETY VIOLATION: Simultaneous GREEN (${greenApproaches.join(', ')}) and YELLOW (${yellowApproaches.join(', ')}) detected.`,
      };
    }

    // Never allow multiple simultaneous clearance intervals
    if (yellowApproaches.length > 1) {
      return {
        safe: false,
        reason: `CRITICAL SAFETY VIOLATION: Multiple simultaneous YELLOW clearance intervals detected on [${yellowApproaches.join(', ')}].`,
      };
    }

    return { safe: true };
  }

  /**
   * Safe transition sequence: GREEN -> YELLOW -> ALL RED -> next approach GREEN
   */
  static validatePhaseTransition(
    currentPhase: PhaseType,
    nextPhase: PhaseType
  ): { legal: boolean; reason?: string } {
    if (currentPhase === nextPhase) {
      return { legal: true };
    }

    if (currentPhase.endsWith('_GREEN')) {
      const expectedYellow = currentPhase.replace(/_GREEN$/, '_YELLOW') as PhaseType;
      if (nextPhase !== expectedYellow) {
        return {
          legal: false,
          reason: `Illegal transition from ${currentPhase} directly to ${nextPhase}. Must clear through ${expectedYellow}.`,
        };
      }
      return { legal: true };
    }

    if (currentPhase.endsWith('_YELLOW')) {
      if (nextPhase !== 'ALL_RED') {
        return {
          legal: false,
          reason: `Illegal transition from ${currentPhase} to ${nextPhase}. Must clear through ALL_RED first.`,
        };
      }
      return { legal: true };
    }

    if (currentPhase === 'ALL_RED') {
      if (!nextPhase.endsWith('_GREEN')) {
        return {
          legal: false,
          reason: `ALL_RED may only transition into a GREEN phase, received: ${nextPhase}`,
        };
      }
      return { legal: true };
    }

    return { legal: true };
  }
}
