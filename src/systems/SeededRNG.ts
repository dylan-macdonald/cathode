/**
 * Deterministic pseudo-random number generator using the Mulberry32 algorithm.
 * Produces reproducible sequences from a given numeric seed.
 */
export class SeededRNG {
  private _state: number;

  constructor(seed: number) {
    this._state = seed | 0;
  }

  /** Returns a float in [0, 1) — drop-in replacement for Math.random(). */
  next(): number {
    let t = (this._state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] (inclusive on both ends). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick a random element from a non-empty array. */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Return a shuffled copy of the array (Fisher-Yates). */
  shuffle<T>(arr: T[]): T[] {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /** Return true with the given probability (0-1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Create an RNG seeded from a date string like "2026-02-27". */
  static fromDateString(dateStr: string): SeededRNG {
    return new SeededRNG(SeededRNG.hashString(dateStr));
  }

  /** Create an RNG seeded from today's date (YYYY-MM-DD). */
  static todaySeed(): SeededRNG {
    return SeededRNG.fromDateString(new Date().toISOString().slice(0, 10));
  }

  /** Simple string hash suitable for seed generation. */
  static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash + ch) | 0;
    }
    return hash;
  }
}

export default SeededRNG;
