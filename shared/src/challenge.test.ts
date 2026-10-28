import { describe, expect, it } from 'vitest'
import { CHALLENGE_MISSION_SECONDS, formatClock } from './challenge.ts'

describe('duración del Desafío', () => {
  it('dura 3:00 en total', () => {
    expect(CHALLENGE_MISSION_SECONDS).toBe(180)
    expect(formatClock(CHALLENGE_MISSION_SECONDS)).toBe('3:00')
    expect(formatClock(179)).toBe('2:59')
    expect(formatClock(0)).toBe('0:00')
  })
})
