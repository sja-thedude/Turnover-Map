import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColourMode, Results, SideKey, Team, Zone } from './types'
import { ClipList, Players, StyleScatter } from './Advanced'
import Pitch from './Pitch'
import { DIV_LABELS, SEQ_LABELS, fmtPct, fmtRatio, fmtXg, ordinal, ratio } from './scale'
import { HeroArt, Logo, OffsideArt, StepClock, StepShot, StepWin, TapZoneArt } from './Illustrations'

const DEFAULT_TEAM = 'Leicester City'

type Theme = 'light' | 'dark'

function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => storedTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1211' : '#f5f3ee')
  }, [theme])
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('theme', next)
      } catch {
        /* private mode: theme just won't persist */
      }
      return next
    })
  return { theme, toggle }
}

function useTween(target: number, ms = 700) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setV(a + (target - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = target
    }
  }, [target, ms])
  return v
}

function Reveal({ children, className = '', as: Tag = 'section' }: { children: React.ReactNode; className?: string; as?: 'section' | 'div' }) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setShown(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref as never} className={`reveal ${shown ? 'in' : ''} ${className}`}>
      {children}
    </Tag>
  )
}

function readTeamFromUrl() {
  return new URLSearchParams(location.search).get('team')
}

export default function App() {
  const { theme, toggle } = useTheme()
  const [data, setData] = useState<Results | null>(null)
  const [error, setError] = useState(false)
  const [teamName, setTeamName] = useState(readTeamFromUrl() ?? DEFAULT_TEAM)

  const load = useCallback(() => {
    setError(false)
    fetch('/results.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
  }, [])
  useEffect(load, [load])

  const team = useMemo(
    () => data?.teams.find((t) => t.name === teamName) ?? data?.teams.find((t) => t.name === DEFAULT_TEAM),
    [data, teamName],
  )

  const pickTeam = (name: string) => {
    setTeamName(name)
    const u = new URL(location.href)
    u.searchParams.set('team', name)
    history.replaceState(null, '', u)
  }

  return (
    <>
      <a className="skip" href="#main">
        Skip to the maps
      </a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="brand" href="/" aria-label="Turnover Map home">
            <Logo />
            <span>Turnover Map</span>
          </a>
          <div className="topbar-right">
            <span className="chip">Premier League 2015/16</span>
            <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <span className={`sun-moon ${theme}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">Pressing analytics for coaching staff</p>
          <h1>
            Where do you win the ball back, <em>and does it lead anywhere?</em>
          </h1>
          <p className="lede">
            Every open-play regain of the 2015/16 Premier League season, mapped by zone and scored by what happened in
            the next ten seconds. See which parts of your press create chances and which are effort for nothing.
          </p>
          <label className="picker">
            <span>Team</span>
            <select value={team?.name ?? teamName} onChange={(e) => pickTeam(e.target.value)} disabled={!data}>
              {(data?.teams ?? [{ name: teamName }]).map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>
        <HeroArt />
      </section>

      <main id="main" className="wrap">
        {error ? (
          <ErrorState onRetry={load} />
        ) : !data || !team ? (
          <Skeleton />
        ) : (
          <Dashboard key={team.name} data={data} team={team} onPick={pickTeam} />
        )}
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <a className="brand" href="/">
              <Logo />
              <span>Turnover Map</span>
            </a>
            <p>Built for the AQX Sports Analytics Data Bowl 4.0.</p>
          </div>
          <p className="cite">
            Data: <a href="https://github.com/statsbomb/open-data">StatsBomb Open Data</a>, Premier League 2015/16, all
            380 matches. Event data © StatsBomb, used under their open data terms. All analysis is precomputed; nothing
            is processed in your browser.
          </p>
        </div>
      </footer>
    </>
  )
}

function Dashboard({ data, team, onPick }: { data: Results; team: Team; onPick: (name: string) => void }) {
  const [mode, setMode] = useState<ColourMode>('value')
  const [showChains, setShowChains] = useState(false)
  const { meta } = data
  return (
    <div className="dash">
      <div className="toolbar">
        <h2 className="team-title">
          {team.name}
          <span>
            {team.matches} matches · {meta.competition} {meta.season}
          </span>
        </h2>
        <div className="toolbar-actions">
          <ShareButton team={team.name} />
          <button className="btn ghost" onClick={() => window.print()}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M4 6V2h8v4M4 12H2V7h12v5h-2M4 10h8v4H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Print briefing
          </button>
        </div>
      </div>
      <Kpis team={team} />

      <Reveal className="notes-wrap">
        <div className="section-head">
          <h2>Coach's notes</h2>
          <p>Generated from the numbers below, using only zones with at least {meta.min_n} turnovers.</p>
        </div>
        <div className="notes">
          {team.summary.map((n) => (
            <article key={n.title} className={`note note-${n.kind}`}>
              <h3>
                <span className="note-dot" aria-hidden="true" />
                {n.title}
              </h3>
              <p dangerouslySetInnerHTML={{ __html: n.text }} />
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal className="maps-wrap">
        <div className="section-head row">
          <div>
            <h2>The maps</h2>
            <p>
              Each zone is coloured by what a turnover there was worth, not how many there were. Your team always attacks
              left to right.
            </p>
          </div>
          <div className="map-controls">
            <div className="seg" role="radiogroup" aria-label="Colour zones by">
              <button role="radio" aria-checked={mode === 'value'} onClick={() => setMode('value')}>
                xG per turnover
              </button>
              <button role="radio" aria-checked={mode === 'league'} onClick={() => setMode('league')}>
                vs league average
              </button>
            </div>
            <label className="switch">
              <input type="checkbox" checked={showChains} onChange={(e) => setShowChains(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              <span>Show regain → shot chains</span>
            </label>
          </div>
        </div>
        <Legend mode={mode} minN={meta.min_n} />
        <div className="maps">
          <MapCard
            side="won"
            team={team}
            mode={mode}
            showChains={showChains}
            title="Turnovers won"
            sub={`Where ${team.name} won the ball, and the xG they created within ${meta.shot_window_s}s.`}
          />
          <MapCard
            side="conceded"
            team={team}
            mode={mode}
            showChains={showChains}
            title="Turnovers conceded"
            sub={`Where ${team.name} lost the ball, and the xG opponents created within ${meta.shot_window_s}s.`}
          />
        </div>
      </Reveal>

      <Reveal>
        <div className="section-head">
          <h2>By third</h2>
          <p>Pooling zones into thirds gives larger samples, especially high up the pitch where regains are rare.</p>
        </div>
        <div className="thirds-grid">
          <Thirds title="Won: xG per regain" thirds={team.won.totals.thirds} />
          <Thirds title="Conceded: xG per turnover" thirds={team.conceded.totals.thirds} />
        </div>
      </Reveal>

      <Reveal>
        <div className="section-head">
          <h2>Does the score explain it?</h2>
          <p>
            Teams that lead sit deeper and counter into space, so regains are worth more. Compare each game state with the
            league in the same state before crediting the press.
          </p>
        </div>
        <div className="thirds-grid">
          <Thirds title="Won: xG per regain by score" thirds={team.states.won.map((s) => ({ ...s, name: s.state }))} />
          <Thirds
            title="Conceded: xG per turnover by score"
            thirds={team.states.conceded.map((s) => ({ ...s, name: s.state }))}
          />
        </div>
      </Reveal>

      <Reveal>
        <div className="section-head">
          <h2>People and context</h2>
          <p>Who does the winning, and where this team sits among the 20 in the league.</p>
        </div>
        <div className="context-grid">
          <Players players={team.players} />
          <StyleScatter teams={data.teams} current={team.name} onPick={onPick} />
        </div>
      </Reveal>

      <Reveal>
        <ClipList team={team} />
      </Reveal>

      <Reveal>
        <ZoneTable team={team} minN={meta.min_n} />
      </Reveal>

      <Reveal>
        <Method meta={meta} />
      </Reveal>
    </div>
  )
}

function Kpis({ team }: { team: Team }) {
  const w = team.won.totals
  const c = team.conceded.totals
  const perMatch = useTween(w.per_match)
  const shotRate = useTween(w.shot_rate * 100)
  const xgWon = useTween(w.xg)
  const xgCon = useTween(c.xg)
  return (
    <section className="kpis" aria-label="Season headline numbers">
      <div className="kpi">
        <span className="kpi-label">Open-play regains</span>
        <span className="kpi-value">{perMatch.toFixed(1)}</span>
        <span className="kpi-sub">per match · {w.n.toLocaleString()} in total</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Led to a shot within 10s</span>
        <span className="kpi-value">{shotRate.toFixed(1)}%</span>
        <span className="kpi-sub">{w.shots} shots · {w.goals} goals</span>
      </div>
      <div className="kpi accent">
        <span className="kpi-label">xG created from regains</span>
        <span className="kpi-value">{xgWon.toFixed(1)}</span>
        <span className="kpi-sub">{ordinal(team.ranks.xg_won)} of 20 in the league</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">xG conceded after losing it</span>
        <span className="kpi-value">{xgCon.toFixed(1)}</span>
        <span className="kpi-sub">
          {ordinal(team.ranks.xg_conceded)} of 20 · {c.n.toLocaleString()} turnovers
        </span>
      </div>
    </section>
  )
}

function Legend({ mode, minN }: { mode: ColourMode; minN: number }) {
  const labels = mode === 'value' ? SEQ_LABELS : DIV_LABELS
  const prefix = mode === 'value' ? 'seq' : 'div'
  return (
    <div className="legend" aria-label="Colour key">
      <span className="legend-title">{mode === 'value' ? 'xG per turnover' : 'xG per turnover ÷ league average for that zone'}</span>
      <div className="legend-row">
        <ol className="legend-scale">
          {labels.map((l, i) => (
            <li key={l}>
              <span className={`sw ${prefix}-${i}`} />
              <span>{l}</span>
            </li>
          ))}
        </ol>
        <span className="legend-low">
          <span className="sw low" />
          Fewer than {minN} turnovers: not enough to judge
        </span>
      </div>
    </div>
  )
}

function MapCard({
  side,
  team,
  mode,
  showChains,
  title,
  sub,
}: {
  side: SideKey
  team: Team
  mode: ColourMode
  showChains: boolean
  title: string
  sub: string
}) {
  const zones = team[side].zones
  const [sel, setSel] = useState<string | null>(null)
  const z = zones.find((x) => x.label === sel) ?? null
  return (
    <article className={`map-card side-${side}`}>
      <header>
        <h3>{title}</h3>
        <p>{sub}</p>
      </header>
      <Pitch
        id={side}
        zones={zones}
        mode={mode}
        side={side}
        selected={sel}
        onSelect={setSel}
        chains={showChains ? team.chains.filter((c) => c.side === side) : undefined}
      />
      <p className="attack-label">Attacking direction</p>
      {showChains && (
        <p className="chain-key">
          <span className="ck-line" /> Regain → shot <span className="ck-line goal" /> Ended in a goal ·{' '}
          {team.chains.filter((c) => c.side === side).length} chains
        </p>
      )}
      <ZoneDetail z={z} side={side} />
    </article>
  )
}

function ZoneDetail({ z, side }: { z: Zone | null; side: SideKey }) {
  if (!z)
    return (
      <div className="detail empty">
        <TapZoneArt />
        <p>Tap or hover any zone to see its numbers and sample size.</p>
      </div>
    )
  const r = ratio(z)
  return (
    <div className="detail" aria-live="polite" key={z.label}>
      <div className="detail-head">
        <span className="zone-tag">{z.label}</span>
        <span className="detail-name">{z.name}</span>
        {z.low_n && <span className="badge warn">Low sample</span>}
      </div>
      <dl>
        <div>
          <dt>Turnovers</dt>
          <dd>{z.n}</dd>
        </div>
        <div>
          <dt>{side === 'won' ? 'Led to our shot' : 'Led to their shot'}</dt>
          <dd>
            {z.shots} <small>({fmtPct(z.shot_rate)})</small>
          </dd>
        </div>
        <div>
          <dt>xG per turnover</dt>
          <dd>{fmtXg(z.xg_per)}</dd>
        </div>
        <div>
          <dt>League, same zone</dt>
          <dd>
            {fmtXg(z.league_xg_per)} <small>({fmtRatio(r)})</small>
          </dd>
        </div>
      </dl>
      <p className="detail-foot">
        {z.low_n
          ? `Only ${z.n} turnovers here all season. Too few to draw any conclusion.`
          : z.clear_gap
            ? `The gap to the league average is bigger than chance would usually produce.`
            : `Not clearly different from the league average at this sample size.`}
        {side === 'won' && !z.low_n && ` ${fmtPct(z.pressed_rate)} came within 5s of our own pressure.`}
      </p>
    </div>
  )
}

interface BarRow {
  name: string
  n: number
  xg_per: number
  league_xg_per: number
  clear_gap: boolean
  low_n: boolean
}

function Thirds({ title, thirds }: { title: string; thirds: BarRow[] }) {
  const max = Math.max(...thirds.flatMap((t) => [t.xg_per, t.league_xg_per]), 0.001)
  return (
    <figure className="thirds">
      <figcaption>{title}</figcaption>
      {[...thirds].reverse().map((t) => (
        <div className="third" key={t.name}>
          <div className="third-label">
            <span>{t.name}</span>
            <span className="third-n">n={t.n}</span>
          </div>
          <div className="bar-track" title={`${t.name}: ${fmtXg(t.xg_per)} vs league ${fmtXg(t.league_xg_per)}`}>
            <div className="bar" style={{ width: `${(t.xg_per / max) * 100}%` }} />
            <div className="tick" style={{ left: `${(t.league_xg_per / max) * 100}%` }} aria-hidden="true" />
          </div>
          <div className="third-val">
            {fmtXg(t.xg_per)}
            <small>{t.low_n ? ' · low n' : t.clear_gap ? ' · clear gap' : ''}</small>
          </div>
        </div>
      ))}
      <p className="thirds-key">
        <span className="key-bar" /> This team <span className="key-tick" /> League average
      </p>
    </figure>
  )
}

type SortKey = 'label' | 'n' | 'shots' | 'shot_rate' | 'xg' | 'xg_per' | 'ratio'

function ZoneTable({ team, minN }: { team: Team; minN: number }) {
  const [side, setSide] = useState<SideKey>('won')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'xg_per', desc: true })
  const rows = useMemo(() => {
    const val = (z: Zone) => (sort.key === 'ratio' ? ratio(z) : sort.key === 'label' ? z.label : z[sort.key])
    // Low-sample zones always sink to the bottom so a 1-from-1 zone never tops the table.
    return [...team[side].zones].sort((a, b) => {
      if (a.low_n !== b.low_n && sort.key !== 'label') return a.low_n ? 1 : -1
      const va = val(a)
      const vb = val(b)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return sort.desc ? -c : c
    })
  }, [team, side, sort])
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'label' }))}>
        {label}
        <span className="arrow" aria-hidden="true">
          {sort.key === key ? (sort.desc ? '↓' : '↑') : ''}
        </span>
      </button>
    </th>
  )
  const t = team[side].totals
  return (
    <div className="table-wrap">
      <div className="section-head row">
        <div>
          <h2>Check the work</h2>
          <p>Every zone, every number. Rows with fewer than {minN} turnovers are shown but marked.</p>
        </div>
        <div className="seg" role="radiogroup" aria-label="Table side">
          <button role="radio" aria-checked={side === 'won'} onClick={() => setSide('won')}>
            Won
          </button>
          <button role="radio" aria-checked={side === 'conceded'} onClick={() => setSide('conceded')}>
            Conceded
          </button>
        </div>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Zone table">
        <table>
          <thead>
            <tr>
              {th('label', 'Zone')}
              <th className="area">Area</th>
              {th('n', 'Turnovers')}
              {th('shots', 'Shots')}
              {th('shot_rate', 'Shot %')}
              {th('xg', 'xG')}
              {th('xg_per', 'xG / turnover')}
              {th('ratio', 'vs league')}
              <th>Sample</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((z) => (
              <tr key={z.label} className={z.low_n ? 'low' : ''}>
                <td>
                  <span className="zone-tag">{z.label}</span>
                </td>
                <td className="area">{z.name}</td>
                <td>{z.n}</td>
                <td>{z.shots}</td>
                <td>{fmtPct(z.shot_rate)}</td>
                <td>{z.xg.toFixed(2)}</td>
                <td>{fmtXg(z.xg_per)}</td>
                <td>{fmtRatio(ratio(z))}</td>
                <td>{z.low_n ? <span className="badge warn">Low</span> : z.clear_gap ? <span className="badge ok">Clear gap</span> : <span className="badge">OK</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Season total</td>
              <td>{t.n}</td>
              <td>{t.shots}</td>
              <td>{fmtPct(t.shot_rate)}</td>
              <td>{t.xg.toFixed(2)}</td>
              <td>{fmtXg(t.xg_per)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Method({ meta }: { meta: Results['meta'] }) {
  return (
    <div className="method">
      <div className="section-head">
        <h2>How it works</h2>
        <p>
          {meta.turnovers.toLocaleString()} open-play turnovers from {meta.matches} matches, processed offline in Python.
        </p>
      </div>
      <ol className="steps">
        <li>
          <StepWin />
          <h3>1. Find the regain</h3>
          <p>
            Every new possession that starts in open play after the opponent had the ball: tackles, interceptions,
            recoveries and loose balls. Set pieces and restarts are excluded.
          </p>
        </li>
        <li>
          <StepClock />
          <h3>2. Start the clock</h3>
          <p>
            Follow the same possession for {meta.shot_window_s} seconds. If it ends in a shot, the regain is counted as
            converted. Penalties are excluded.
          </p>
        </li>
        <li>
          <StepShot />
          <h3>3. Score the outcome</h3>
          <p>
            Each regain is worth the StatsBomb xG of the shots that followed, combined as the chance at least one went in,
            so rebounds aren't double counted.
          </p>
        </li>
      </ol>
      <div className="caveats">
        <h3>Reading it honestly</h3>
        <ul>
          <li>
            <strong>Correlation, not causation.</strong> A zone where regains lead to shots shows an association. It does
            not prove that pressing there causes the shots: game state, opponent quality and team shape all play a part.
          </li>
          <li>
            <strong>Sample sizes are shown everywhere.</strong> Zones under {meta.min_n} turnovers are hatched on the map,
            marked in the table, and never used in the coach's notes.
          </li>
          <li>
            <strong>"Clear gap"</strong> means the team's figure sits more than about two standard errors from the league
            average for that zone. Most zones don't clear that bar in a single season, and the notes say so.
          </li>
          <li>
            <strong>Same frame for both maps.</strong> Turnovers conceded are flipped so your team always attacks left to
            right: a red zone high on the right of the conceded map is somewhere you lose the ball in the opponent's half.
          </li>
        </ul>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading the season's turnovers">
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div className="kpi shimmer" key={i} />
        ))}
      </div>
      <div className="maps">
        {[0, 1].map((i) => (
          <div className="map-card" key={i}>
            <div className="sk-line shimmer" />
            <div className="sk-pitch">
              {Array.from({ length: 24 }, (_, j) => (
                <span key={j} className="shimmer" style={{ animationDelay: `${(j % 6) * 80}ms` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="sk-caption">Loading the season’s turnovers…</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <OffsideArt />
      <h2>The data didn't arrive</h2>
      <p>We couldn't load the season file. Check your connection and try again.</p>
      <button className="btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

function ShareButton({ team }: { team: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${location.origin}/?team=${encodeURIComponent(team)}`
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: `${team} · Turnover Map`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* share sheet dismissed or clipboard blocked: nothing to report */
    }
  }
  return (
    <button className="btn ghost" onClick={share} aria-live="polite">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 013.7 3.7L10.7 8.2M9 11.5l-1.2 1.2a2.6 2.6 0 01-3.7-3.7L5.3 7.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {copied ? 'Link copied' : 'Share'}
    </button>
  )
}
