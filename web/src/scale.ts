import type { ColourMode, Zone } from './types'

// Binned scales read more easily than a continuous ramp for a non-technical audience.
export const SEQ_STEPS = [0.002, 0.005, 0.01, 0.02, 0.04]
export const DIV_STEPS = [0.5, 0.8, 1.25, 2]

export const SEQ_LABELS = ['< 0.002', '0.002', '0.005', '0.01', '0.02', '0.04+']
export const DIV_LABELS = ['< 0.5×', '0.5–0.8×', 'Level', '1.25–2×', '2×+']

export function ratio(z: Zone) {
  if (!z.league_xg_per) return z.xg_per ? 2 : 1
  return z.xg_per / z.league_xg_per
}

export function bin(z: Zone, mode: ColourMode) {
  const v = mode === 'value' ? z.xg_per : ratio(z)
  const steps = mode === 'value' ? SEQ_STEPS : DIV_STEPS
  return steps.filter((s) => v >= s).length
}

export const fmtXg = (v: number) => (v >= 0.1 ? v.toFixed(2) : v.toFixed(3)).replace(/^0/, '')
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`
export const fmtRatio = (v: number) => `${v.toFixed(1)}×`

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
