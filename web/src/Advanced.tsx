import { useMemo, useState } from 'react'
import type { Chain, Player, SideKey, Team } from './types'
import { fmtXg } from './scale'

/** Regain -> shot arrows drawn over a pitch, in pitch units. */
export function ChainsLayer({ chains, id }: { chains: Chain[]; id: string }) {
  return (
    <g className="chains" aria-hidden="true">
      <defs>
        <marker id={`${id}-head`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 Z" className="chain-head" />
        </marker>
      </defs>
      {chains.map((c, i) => (
        <g key={i} className={`chain${c.goal ? ' goal' : ''}`} style={{ animationDelay: `${Math.min(i * 18, 900)}ms` }}>
          <line x1={c.x} y1={c.y} x2={c.sx} y2={c.sy} markerEnd={`url(#${id}-head)`} />
          <circle cx={c.x} cy={c.y} r={0.9} className="chain-start" />
          {c.goal && <circle cx={c.sx} cy={c.sy} r={1.8} className="chain-goal" />}
        </g>
      ))}
    </g>
  )
}

function csvCell(v: string | number | boolean) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(team: Team, rows: Chain[], side: SideKey) {
  const head = ['date', 'opponent', 'venue', 'half', 'minute', 'won_by', 'how', 'shot_by', 'xg', 'goal', 'regain_x', 'regain_y']
  const body = rows.map((c) =>
    [c.date, c.opp, c.home ? 'H' : 'A', c.period, `${c.min}:${String(c.sec).padStart(2, '0')}`, c.player, c.kind, c.shooter, c.xg, c.goal ? 'yes' : 'no', c.x, c.y]
      .map(csvCell)
      .join(','),
  )
  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${team.name.toLowerCase().replace(/\s+/g, '-')}-${side}-regain-chains.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function ClipList({ team }: { team: Team }) {
  const [side, setSide] = useState<SideKey>('won')
  const [goalsOnly, setGoalsOnly] = useState(false)
  const rows = useMemo(
    () => team.chains.filter((c) => c.side === side && (!goalsOnly || c.goal)).sort((a, b) => b.xg - a.xg),
    [team, side, goalsOnly],
  )
  return (
    <div className="clips">
      <div className="section-head row">
        <div>
          <h2>Clip list for video review</h2>
          <p>
            Every regain that became a shot within ten seconds, best chances first. Hand it to the video analyst, or
            download it as a spreadsheet.
          </p>
        </div>
        <div className="clip-controls">
          <div className="seg" role="radiogroup" aria-label="Clip list side">
            <button role="radio" aria-checked={side === 'won'} onClick={() => setSide('won')}>
              Ours
            </button>
            <button role="radio" aria-checked={side === 'conceded'} onClick={() => setSide('conceded')}>
              Against us
            </button>
          </div>
          <label className="check">
            <input type="checkbox" checked={goalsOnly} onChange={(e) => setGoalsOnly(e.target.checked)} />
            <span>Goals only</span>
          </label>
          <button className="btn ghost" onClick={() => downloadCsv(team, rows, side)} disabled={!rows.length}>
            <DownloadIcon /> CSV
          </button>
        </div>
      </div>
      {rows.length ? (
        <ol className="clip-grid">
          {rows.slice(0, 12).map((c, i) => (
            <li key={`${c.date}-${c.min}-${c.sec}-${i}`} className={`clip${c.goal ? ' is-goal' : ''}`}>
              <MiniPitch c={c} />
              <div className="clip-body">
                <div className="clip-top">
                  <span className="clip-time">
                    {c.min}'{String(c.sec).padStart(2, '0')}
                  </span>
                  <span className="clip-xg">{fmtXg(c.xg)} xG</span>
                  {c.goal && <span className="badge ok">Goal</span>}
                </div>
                <p className="clip-match">
                  {c.home ? 'vs' : 'at'} {c.opp} <span>· {formatDate(c.date)}</span>
                </p>
                <p className="clip-who">
                  {c.kind === 'Loose ball' ? 'Loose ball won' : c.kind} by <b>{c.player}</b> → shot by <b>{c.shooter}</b>
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-block">
          <EmptyGoalArt />
          <p>No regain led to a goal{side === 'won' ? '' : ' against this team'} within ten seconds. Untick "Goals only" to see every shot.</p>
        </div>
      )}
      {rows.length > 12 && <p className="clip-more">Showing the 12 best of {rows.length}. The CSV has them all.</p>}
    </div>
  )
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MiniPitch({ c }: { c: Chain }) {
  return (
    <svg viewBox="-2 -2 124 84" className="mini-pitch" aria-hidden="true">
      <rect x="0" y="0" width="120" height="80" rx="2" className="mp-bg" />
      <g className="mp-lines">
        <rect x="0" y="0" width="120" height="80" rx="2" />
        <line x1="60" y1="0" x2="60" y2="80" />
        <rect x="102" y="18" width="18" height="44" />
        <rect x="0" y="18" width="18" height="44" />
        <circle cx="60" cy="40" r="10" />
      </g>
      <line x1={c.x} y1={c.y} x2={c.sx} y2={c.sy} className="mp-path" />
      <circle cx={c.x} cy={c.y} r="3.4" className="mp-start" />
      <circle cx={c.sx} cy={c.sy} r="3.4" className={`mp-end${c.goal ? ' goal' : ''}`} />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyGoalArt() {
  return (
    <svg viewBox="0 0 120 80" className="empty-art" aria-hidden="true">
      <rect x="20" y="14" width="80" height="46" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" />
      <g stroke="var(--line)" strokeWidth="0.8">
        {[30, 40, 50, 60, 70, 80, 90].map((x) => (
          <line key={x} x1={x} y1="14" x2={x} y2="60" />
        ))}
      </g>
      <line x1="8" y1="60" x2="112" y2="60" stroke="var(--ink-3)" strokeWidth="1.5" />
      <circle cx="60" cy="70" r="6" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.6" className="bob" />
    </svg>
  )
}

export function Players({ players }: { players: Player[] }) {
  const max = Math.max(...players.map((p) => p.n), 1)
  return (
    <figure className="players">
      <figcaption>
        Ball-winners
        <span>Open-play regains · shots and xG that followed</span>
      </figcaption>
      <ol>
        {players.map((p) => (
          <li key={p.name}>
            <span className="pl-name">{p.name}</span>
            <span className="pl-bar" title={`${p.n} regains, ${p.high} in the opposition half`}>
              <span className="pl-total" style={{ width: `${(p.n / max) * 100}%` }}>
                <span className="pl-high" style={{ width: `${(p.high / p.n) * 100}%` }} />
              </span>
            </span>
            <span className="pl-n">{p.n}</span>
            <span className="pl-xg">
              {p.shots} → {p.xg.toFixed(2)} xG
            </span>
          </li>
        ))}
      </ol>
      <p className="thirds-key">
        <span className="key-bar" /> Opposition half <span className="key-bar muted" /> Elsewhere
      </p>
    </figure>
  )
}

/** All 20 teams: how high they win it vs what a regain is worth. Click a dot to switch team. */
export function StyleScatter({ teams, current, onPick }: { teams: Team[]; current: string; onPick: (n: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 520
  const H = 400
  const P = { l: 62, r: 14, t: 16, b: 58 }
  const xs = teams.map((t) => t.style.high_per_match)
  const ys = teams.map((t) => t.style.xg_per)
  const x0 = Math.floor(Math.min(...xs)) - 0.5
  const x1 = Math.ceil(Math.max(...xs)) + 0.5
  const y1 = Math.ceil(Math.max(...ys) * 1000 + 1) / 1000
  const sx = (v: number) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r)
  const sy = (v: number) => H - P.b - (v / y1) * (H - P.t - P.b)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const xticks = Array.from({ length: Math.round(x1 - x0) + 1 }, (_, i) => x0 + 0.5 + i).filter((v) => v <= x1)
  const yticks = [0, 0.002, 0.004, 0.006, 0.008, 0.01].filter((v) => v <= y1)
  const label = hover ?? current
  const lt = teams.find((t) => t.name === label)
  return (
    <figure className="scatter">
      <figcaption>
        Pressing style across the league
        <span>Tap a team to load it</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Scatter plot of all 20 teams">
        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} className="sc-bg" rx="6" />
        {yticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} className="sc-grid" />
            <text x={P.l - 10} y={sy(v) + 5} className="sc-tick" textAnchor="end">
              {fmtXg(v)}
            </text>
          </g>
        ))}
        {xticks.map((v) => (
          <text key={v} x={sx(v)} y={H - P.b + 24} className="sc-tick" textAnchor="middle">
            {v}
          </text>
        ))}
        <line x1={sx(mx)} x2={sx(mx)} y1={P.t} y2={H - P.b} className="sc-mean" />
        <line x1={P.l} x2={W - P.r} y1={sy(my)} y2={sy(my)} className="sc-mean" />
        <text x={W - P.r - 8} y={H - P.b - 10} className="sc-quad" textAnchor="end">
          High, little return
        </text>
        <text x={W - P.r - 8} y={P.t + 22} className="sc-quad" textAnchor="end">
          High and dangerous
        </text>
        <text x={P.l + 8} y={P.t + 22} className="sc-quad">
          Deep, then dangerous
        </text>
        <text x={P.l + 8} y={H - P.b - 10} className="sc-quad">
          Deep and quiet
        </text>
        <text x={(P.l + W - P.r) / 2} y={H - 10} className="sc-axis" textAnchor="middle">
          Regains in the opposition half, per match →
        </text>
        <text x={18} y={(P.t + H - P.b) / 2} className="sc-axis" textAnchor="middle" transform={`rotate(-90 18 ${(P.t + H - P.b) / 2})`}>
          xG per regain →
        </text>
        {teams.map((t) => {
          const on = t.name === current
          return (
            <g
              key={t.name}
              className={`sc-dot${on ? ' on' : ''}${hover === t.name ? ' hover' : ''}`}
              transform={`translate(${sx(t.style.high_per_match)} ${sy(t.style.xg_per)})`}
              tabIndex={0}
              role="button"
              aria-label={`${t.name}: ${t.style.high_per_match} high regains per match, ${fmtXg(t.style.xg_per)} xG per regain`}
              onMouseEnter={() => setHover(t.name)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(t.name)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(t.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(t.name)
                }
              }}
            >
              <circle r="22" className="sc-hit" />
              <circle r={on ? 11 : 8} className="sc-mark" />
            </g>
          )
        })}
        {lt && (
          <g className="sc-label" transform={`translate(${sx(lt.style.high_per_match)} ${sy(lt.style.xg_per)})`} pointerEvents="none">
            <text
              y={sy(lt.style.xg_per) < P.t + 50 ? 30 : -20}
              textAnchor={sx(lt.style.high_per_match) > W - 120 ? 'end' : sx(lt.style.high_per_match) < 120 ? 'start' : 'middle'}
            >
              {lt.name}
            </text>
          </g>
        )}
      </svg>
      <p className="thirds-key">Dashed lines mark the league average on each axis.</p>
    </figure>
  )
}
