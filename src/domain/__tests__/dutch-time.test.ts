import { describe, expect, it } from 'vitest'
import {
  dutchPhraseShape,
  formatDigital,
  fromMinuteOfDay,
  halfHourReferenceError,
  parseDutchVerbalTime,
  toDutchVerbalTime,
} from '../dutch-time'

describe('Dutch verbal time engine', () => {
  it('covers all 12 five-minute cases (archetype 5.1)', () => {
    expect(toDutchVerbalTime({ hours: 8, minutes: 0 })).toBe('8 uur')
    expect(toDutchVerbalTime({ hours: 8, minutes: 5 })).toBe('5 over 8')
    expect(toDutchVerbalTime({ hours: 8, minutes: 10 })).toBe('10 over 8')
    expect(toDutchVerbalTime({ hours: 8, minutes: 15 })).toBe('kwart over 8')
    expect(toDutchVerbalTime({ hours: 8, minutes: 20 })).toBe('10 voor half 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 25 })).toBe('5 voor half 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 30 })).toBe('half 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 35 })).toBe('5 over half 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 40 })).toBe('10 over half 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 45 })).toBe('kwart voor 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 50 })).toBe('10 voor 9')
    expect(toDutchVerbalTime({ hours: 8, minutes: 55 })).toBe('5 voor 9')
  })

  it('handles the 12 o’clock wrap correctly', () => {
    expect(toDutchVerbalTime({ hours: 0, minutes: 0 })).toBe('12 uur')
    expect(toDutchVerbalTime({ hours: 0, minutes: 30 })).toBe('half 1')
    expect(toDutchVerbalTime({ hours: 23, minutes: 55 })).toBe('5 voor 12')
    expect(toDutchVerbalTime({ hours: 11, minutes: 45 })).toBe('kwart voor 12')
    expect(toDutchVerbalTime({ hours: 12, minutes: 20 })).toBe('10 voor half 1')
  })

  it('round-trips phrase → minuteOfDay → phrase', () => {
    for (let minuteOfDay = 0; minuteOfDay < 720; minuteOfDay += 5) {
      const time = fromMinuteOfDay(minuteOfDay)
      const phrase = toDutchVerbalTime(time)
      const back = parseDutchVerbalTime(phrase)
      expect(back).toBe(minuteOfDay)
    }
  })

  it('classifies each five-minute case into its phrase family', () => {
    expect(dutchPhraseShape(0)).toBe('whole')
    expect(dutchPhraseShape(5)).toBe('over-hour')
    expect(dutchPhraseShape(10)).toBe('over-hour')
    expect(dutchPhraseShape(15)).toBe('quarter-over')
    expect(dutchPhraseShape(20)).toBe('to-half')
    expect(dutchPhraseShape(25)).toBe('to-half')
    expect(dutchPhraseShape(30)).toBe('half')
    expect(dutchPhraseShape(35)).toBe('past-half')
    expect(dutchPhraseShape(40)).toBe('past-half')
    expect(dutchPhraseShape(45)).toBe('quarter-to')
    expect(dutchPhraseShape(50)).toBe('to-hour')
    expect(dutchPhraseShape(55)).toBe('to-hour')
  })

  it('rejects minutes outside the five-minute resolution', () => {
    expect(() => dutchPhraseShape(7)).toThrow()
    expect(() => dutchPhraseShape(60)).toThrow()
  })

  it('assigns a family to every phrase the engine can produce', () => {
    // The coaching table switches exhaustively on the family, so a phrase
    // without one would be a missing branch rather than a wrong string.
    for (let minuteOfDay = 0; minuteOfDay < 720; minuteOfDay += 5) {
      const { minutes } = fromMinuteOfDay(minuteOfDay)
      expect(dutchPhraseShape(minutes)).toBeTruthy()
    }
  })

  it('formats digital times with 24-hour zero padding', () => {
    expect(formatDigital({ hours: 8, minutes: 20 })).toBe('08:20')
    expect(formatDigital({ hours: 0, minutes: 5 })).toBe('00:05')
  })

  it('detects the half-hour reference misconception (half 9 → 09:30)', () => {
    expect(halfHourReferenceError('half 9', 9 * 60 + 30)).toBe(true)
    expect(halfHourReferenceError('half 9', 8 * 60 + 30)).toBe(false)
    expect(halfHourReferenceError('10 voor half 9', 8 * 60 + 20)).toBe(false)
    // Direction errors (08:40 for “10 voor half 9”) are a separate signature.
    expect(halfHourReferenceError('10 voor half 9', 8 * 60 + 40)).toBe(false)
  })
})
