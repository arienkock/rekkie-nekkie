/**
 * Measurement unit families with their ACTUAL integer ratios to the base unit
 * (docs/adaptive-learning-design.md §0: m↔km and g↔kg differ by 1,000 —
 * never implement "one position = one zero").
 * Money uses integer cents; €-comma display is presentation only.
 */

export type LengthUnit = 'km' | 'm' | 'dm' | 'cm' | 'mm'
export type MassUnit = 'kg' | 'g' | 'mg'
export type CapacityUnit = 'L' | 'dL' | 'cL' | 'mL'

export const LENGTH_RATIO: Record<LengthUnit, number> = {
  km: 1_000_000, m: 1_000, dm: 100, cm: 10, mm: 1,
}

export const MASS_RATIO: Record<MassUnit, number> = {
  kg: 1_000_000, g: 1_000, mg: 1,
}

export const CAPACITY_RATIO: Record<CapacityUnit, number> = {
  L: 1_000, dL: 100, cL: 10, mL: 1,
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * LENGTH_RATIO[from]) / LENGTH_RATIO[to]
}
export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  return (value * MASS_RATIO[from]) / MASS_RATIO[to]
}
export function convertCapacity(value: number, from: CapacityUnit, to: CapacityUnit): number {
  return (value * CAPACITY_RATIO[from]) / CAPACITY_RATIO[to]
}

/** Amounts are integer cents. €1,80 → 180. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '€−' : '€'
  const abs = Math.abs(Math.round(cents))
  const euros = Math.floor(abs / 100)
  const rest = abs % 100
  return `${sign}${euros},${String(rest).padStart(2, '0')}`
}

/** Parse learner money input: "4,75", "4.75", "475 c", "€ 4,75" → cents.
 *  Accepts decimal comma and point; "€4,5" means €4,50, not €4,05. */
export function parseMoneyCents(input: string): number | null {
  const s = input.trim().replace(/[€\s]/g, '').toLowerCase()
  const centMatch = s.match(/^(\d+)\s*(cent|c)$/)
  if (centMatch) return Number(centMatch[1])
  const m = s.match(/^(\d+)[.,]?(\d{0,2})$/)
  if (!m) return null
  const whole = Number(m[1])
  const fracDigits = m[2] ?? ''
  const cents = fracDigits.length === 0 ? 0 : Number(fracDigits.padEnd(2, '0'))
  return whole * 100 + cents
}

/** Euro denominations for greedy/minimal payment (integer cents). */
export const DENOMINATIONS_CENTS: number[] = [
  50_000, 20_000, 10_000, 5_000, 2_00, 1_00, 50, 20, 10, 5, 2, 1,
]

/** Greedy minimal-coin breakdown; valid for the standard unlimited-supply tray. */
export function greedyBreakdown(cents: number): Array<{ denom: number; count: number }> {
  const result: Array<{ denom: number; count: number }> = []
  let rest = Math.round(cents)
  for (const d of DENOMINATIONS_CENTS) {
    if (rest <= 0) break
    const count = Math.floor(rest / d)
    if (count > 0) {
      result.push({ denom: d, count })
      rest -= count * d
    }
  }
  return result
}