import type { Chain, ColourMode, SideKey, Zone } from './types'
import { ChainsLayer } from './Advanced'
import { bin, fmtRatio, fmtXg, ratio } from './scale'

const W = 120
const H = 80
const ZW = 20
const ZH = 20
const GAP = 0.5

interface Props {
  id: string
  zones: Zone[]
  mode: ColourMode
  side: SideKey
  selected: string | null
  onSelect: (label: string) => void
  chains?: Chain[]
}

export function PitchLines() {
  const box = (flip: boolean) => {
    const x = (v: number) => (flip ? W - v : v)
    const sweep = flip ? 0 : 1
    return (
      <g>
        <rect x={flip ? W - 18 : 0} y={18} width={18} height={44} />
        <rect x={flip ? W - 6 : 0} y={30} width={6} height={20} />
        <circle cx={x(12)} cy={40} r={0.5} className="spot" />
        <path d={`M ${x(18)} 32 A 10 10 0 0 ${sweep} ${x(18)} 48`} />
        <rect x={flip ? W : -2} y={36} width={2} height={8} className="goal" />
        <path d={`M ${x(1)} 0 A 1 1 0 0 ${sweep} ${x(0)} 1`} />
        <path d={`M ${x(0)} ${H - 1} A 1 1 0 0 ${sweep} ${x(1)} ${H}`} />
      </g>
    )
  }
  return (
    <g className="pitch-lines" aria-hidden="true">
      <rect x={0} y={0} width={W} height={H} />
      <line x1={60} y1={0} x2={60} y2={H} />
      <circle cx={60} cy={40} r={10} />
      <circle cx={60} cy={40} r={0.5} className="spot" />
      {box(false)}
      {box(true)}
    </g>
  )
}

export default function Pitch({ id, zones, mode, side, selected, onSelect, chains }: Props) {
  const verb = side === 'won' ? 'won' : 'lost'
  return (
    <svg
      className={`pitch mode-${mode}${chains ? ' has-chains' : ''}`}
      viewBox="-6 -3 132 92"
      role="group"
      aria-label={`Pitch map of turnovers ${verb}, attacking left to right`}
    >
      <defs>
        <pattern id={`${id}-hatch`} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="2.4" className="hatch-line" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} className="pitch-bg" />
      {zones.map((z) => {
        const b = bin(z, mode)
        const isSel = selected === z.label
        const value = mode === 'value' ? fmtXg(z.xg_per) : fmtRatio(ratio(z))
        const cls = z.low_n ? 'zone low' : `zone ${mode === 'value' ? 'seq' : 'div'}-${b}`
        return (
          <g
            key={z.label}
            className={`${cls}${isSel ? ' selected' : ''}`}
            tabIndex={0}
            role="button"
            aria-pressed={isSel}
            aria-label={`Zone ${z.label}, ${z.name}: ${z.n} turnovers ${verb}, ${fmtXg(z.xg_per)} xG per turnover${z.low_n ? ', low sample' : ''}`}
            onClick={() => onSelect(z.label)}
            onMouseEnter={() => onSelect(z.label)}
            onFocus={() => onSelect(z.label)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(z.label)
              }
            }}
          >
            <rect
              className="zone-fill"
              x={z.col * ZW + GAP}
              y={z.row * ZH + GAP}
              width={ZW - GAP * 2}
              height={ZH - GAP * 2}
              rx={1.2}
            />
            {z.low_n && (
              <rect
                x={z.col * ZW + GAP}
                y={z.row * ZH + GAP}
                width={ZW - GAP * 2}
                height={ZH - GAP * 2}
                rx={1.2}
                fill={`url(#${id}-hatch)`}
                className="zone-hatch"
              />
            )}
            <text className="zone-value" x={z.col * ZW + ZW / 2} y={z.row * ZH + ZH / 2 + 0.8}>
              {z.low_n ? '–' : value}
            </text>
            <text className="zone-n" x={z.col * ZW + ZW / 2} y={z.row * ZH + ZH / 2 + 6.4}>
              n={z.n}
            </text>
          </g>
        )
      })}
      <PitchLines />
      {chains && <ChainsLayer chains={chains} id={id} />}
      {'ABCDEF'.split('').map((c, i) => (
        <text key={c} className="axis" x={i * ZW + ZW / 2} y={H + 5}>
          {c}
        </text>
      ))}
      {[1, 2, 3, 4].map((r, i) => (
        <text key={r} className="axis" x={-3.4} y={i * ZH + ZH / 2 + 1.4}>
          {r}
        </text>
      ))}
      <g className="attack-arrow" aria-hidden="true">
        <line x1={46} y1={H + 8.4} x2={72} y2={H + 8.4} />
        <path d={`M 72 ${H + 6.9} L 75 ${H + 8.4} L 72 ${H + 9.9} Z`} />
      </g>
    </svg>
  )
}
