// Deterministic PRNG (mulberry32). Same seed → same sequence, on every machine,
// forever. The engine draws exclusively from this — never Math.random — so a
// replay reproduces the exact piece order. Small, fast, and good enough for a
// game bag (not for cryptography — signing lives elsewhere).

export class Prng {
  private state: number

  constructor(seed: number) {
    // Force to uint32 so behaviour is identical regardless of how the seed arrived.
    this.state = seed >>> 0
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n)
  }
}
