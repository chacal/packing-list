import { describe, expect, it } from 'vitest'
import { formatWeight } from './weight.ts'

describe('formatWeight', () => {
  it('shows grams below a kilo', () => {
    expect(formatWeight(0)).toBe('0 g')
    expect(formatWeight(999)).toBe('999 g')
  })
  it('shows kilos with one decimal', () => {
    expect(formatWeight(1000)).toBe('1.0 kg')
    expect(formatWeight(8798)).toBe('8.8 kg')
  })
})
