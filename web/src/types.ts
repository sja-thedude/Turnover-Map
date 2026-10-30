export interface Stats {
  n: number
  shots: number
  goals: number
  xg: number
  xg_per: number
  se: number | null
  shot_rate: number
  pressed_rate: number
}

export interface Zone extends Stats {
  col: number
  row: number
  label: string
  name: string
  low_n: boolean
  league_xg_per: number
  vs_league: number | null
  clear_gap: boolean
}

export interface Third extends Stats {
  name: string
  league_xg_per: number
  league_share: number
  share: number
  low_n: boolean
  clear_gap: boolean
}

export interface Totals extends Stats {
  per_match: number
  thirds: Third[]
}

export interface Side {
  totals: Totals
  zones: Zone[]
}

export interface Note {
  kind: 'lead' | 'good' | 'bad' | 'warn' | 'note'
  title: string
  text: string
}

export interface Chain {
  side: SideKey
  date: string
  opp: string
  home: boolean
  period: number
  min: number
  sec: number
  player: string
  shooter: string
  kind: string
  x: number
  y: number
  sx: number
  sy: number
  xg: number
  goal: boolean
}

export interface Player {
  name: string
  n: number
  high: number
  shots: number
  xg: number
}

export interface GameState extends Stats {
  state: 'Leading' | 'Level' | 'Trailing'
  league_xg_per: number
  low_n: boolean
  clear_gap: boolean
}

export interface Team {
  name: string
  matches: number
  style: { high_per_match: number; high_share: number; xg_per: number; conceded_xg_per: number }
  chains: Chain[]
  players: Player[]
  states: { won: GameState[]; conceded: GameState[] }
  won: Side
  conceded: Side
  summary: Note[]
  ranks: { xg_won: number; xg_conceded: number }
}

export interface Results {
  meta: {
    competition: string
    season: string
    matches: number
    turnovers: number
    generated: string
    cols: number
    rows: number
    shot_window_s: number
    min_n: number
    source: string
    source_url: string
  }
  league: { won: Stats[] }
  teams: Team[]
}

export type ColourMode = 'value' | 'league'
export type SideKey = 'won' | 'conceded'
