import { describe, expect, it } from 'vitest'
import { Prng } from './prng'
import { newBag } from './board'

describe('Prng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Prng(42)
    const b = new Prng(42)
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces values in [0, 1)', () => {
    const r = new Prng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('differs across seeds', () => {
    expect(new Prng(1).next()).not.toEqual(new Prng(2).next())
  })
})

describe('7-bag', () => {
  it('each bag is a permutation of all 7 pieces', () => {
    const r = new Prng(123)
    for (let b = 0; b < 50; b++) {
      const bag = newBag(r)
      expect([...bag].sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
    }
  })

  it('same seed yields the same bag sequence', () => {
    const a = new Prng(999)
    const b = new Prng(999)
    expect(newBag(a)).toEqual(newBag(b))
    expect(newBag(a)).toEqual(newBag(b))
  })
})
