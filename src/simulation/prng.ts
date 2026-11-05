/**
 * Mulberry32 seeded pseudo-random number generator.
 * Provides deterministic 32-bit PRNG for reproducible traffic experiments.
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a pseudo-random float in [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in [min, max].
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns true with probability p.
   */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Returns current internal state.
   */
  getState(): number {
    return this.state;
  }

  /**
   * Sets internal state.
   */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
