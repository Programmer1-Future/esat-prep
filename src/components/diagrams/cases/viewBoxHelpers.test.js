import { describe, it, expect } from 'vitest'
import { clampYRange } from './viewBoxHelpers'

describe('clampYRange', () => {
  it('returns bounds unchanged when y-span is within maxRatio', () => {
    expect(clampYRange(-2, 4, 8)).toEqual([-2, 4])
  })

  it('returns bounds unchanged when y-span equals maxRatio * xSpan', () => {
    expect(clampYRange(0, 24, 8, 3)).toEqual([0, 24])
  })

  it('centers and clamps when y-span exceeds maxRatio * xSpan', () => {
    // Steep parabola: y from -1 to 32 over x-span 8 → ratio 33/8 > 3
    const [yMin, yMax] = clampYRange(-1, 32, 8, 3)
    expect(yMax - yMin).toBeCloseTo(24, 10)
    expect((yMin + yMax) / 2).toBeCloseTo(15.5, 10)
  })

  it('returns bounds unchanged when xSpan is zero or negative', () => {
    expect(clampYRange(-5, 50, 0)).toEqual([-5, 50])
    expect(clampYRange(-5, 50, -2)).toEqual([-5, 50])
  })

  it('respects a custom maxRatio', () => {
    const [yMin, yMax] = clampYRange(0, 20, 4, 2)
    expect(yMax - yMin).toBeCloseTo(8, 10)
    expect((yMin + yMax) / 2).toBeCloseTo(10, 10)
  })
})
