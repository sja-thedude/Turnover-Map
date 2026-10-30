// Self-drawn SVG illustrations. No third-party imagery.

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 520 360" role="img" aria-label="Illustration: three players press the ball carrier, win it back, and the ball is played forward to a shot on goal">
      <defs>
        <linearGradient id="hero-turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--pitch)" />
          <stop offset="1" stopColor="var(--surface-2)" />
        </linearGradient>
        <radialGradient id="hero-glow">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(260 196) skewX(-14) scale(1 0.82) translate(-230 -150)">
        <rect x="0" y="0" width="460" height="300" rx="10" fill="url(#hero-turf)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={i * 76.6} y="0" width="38.3" height="300" fill="var(--ink)" opacity="0.025" />
        ))}
        <g fill="none" stroke="var(--pitch-line)" strokeWidth="2">
          <rect x="0" y="0" width="460" height="300" rx="10" />
          <line x1="230" y1="0" x2="230" y2="300" />
          <circle cx="230" cy="150" r="38" />
          <rect x="390" y="70" width="70" height="160" />
          <rect x="437" y="112" width="23" height="76" />
          <rect x="0" y="70" width="70" height="160" />
        </g>
        <circle cx="300" cy="128" r="70" fill="url(#hero-glow)" className="hero-pulse" />
        <g stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M 246 82 Q 270 100 290 120" className="draw d1" />
          <path d="M 252 190 Q 276 156 292 136" className="draw d2" />
          <path d="M 352 96 Q 326 108 310 122" className="draw d3" />
        </g>
        <path d="M 304 128 Q 380 110 448 146" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" className="draw d4" />
        <g fill="var(--accent)">
          <circle cx="246" cy="82" r="9" />
          <circle cx="252" cy="190" r="9" />
          <circle cx="352" cy="96" r="9" />
        </g>
        <g fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5">
          <circle cx="300" cy="128" r="9" />
          <circle cx="210" cy="140" r="9" />
          <circle cx="380" cy="200" r="9" />
        </g>
        <circle cx="304" cy="128" r="5" fill="var(--ink)" className="hero-ball" />
      </g>
      <g className="hero-tag t1">
        <rect x="318" y="28" width="168" height="44" rx="22" fill="var(--surface)" stroke="var(--line)" />
        <circle cx="342" cy="50" r="7" fill="var(--accent)" />
        <text x="358" y="55" fill="var(--ink)">Ball won · E2</text>
      </g>
      <g className="hero-tag t2">
        <rect x="30" y="292" width="196" height="44" rx="22" fill="var(--surface)" stroke="var(--line)" />
        <text x="52" y="319" fill="var(--ink-2)">Shot in 6s ·</text>
        <text x="146" y="319" fill="var(--accent)" fontWeight="600">0.21 xG</text>
      </g>
    </svg>
  )
}

export function StepWin() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <rect x="6" y="10" width="108" height="70" rx="8" fill="var(--pitch)" />
      <line x1="60" y1="10" x2="60" y2="80" stroke="var(--pitch-line)" strokeWidth="1.2" />
      <circle cx="60" cy="45" r="12" fill="none" stroke="var(--pitch-line)" strokeWidth="1.2" />
      <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M 40 28 L 62 42" />
        <path d="M 86 30 L 68 42" />
        <path d="M 70 70 L 66 52" />
      </g>
      <g fill="var(--accent)">
        <circle cx="40" cy="28" r="4.5" />
        <circle cx="86" cy="30" r="4.5" />
        <circle cx="70" cy="70" r="4.5" />
      </g>
      <circle cx="65" cy="46" r="4.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.6" />
    </svg>
  )
}

export function StepClock() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <circle cx="60" cy="48" r="30" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="2" />
      <rect x="54" y="10" width="12" height="7" rx="2" fill="var(--ink)" />
      <path d="M 60 48 L 60 18 A 30 30 0 0 1 88.5 38.7 Z" fill="var(--accent)" opacity="0.85" className="clock-wedge" />
      <circle cx="60" cy="48" r="3" fill="var(--ink)" />
      <text x="60" y="68" textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill="var(--ink)">10s</text>
    </svg>
  )
}

export function StepShot() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <rect x="20" y="16" width="80" height="50" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <g stroke="var(--pitch-line)" strokeWidth="0.8">
        {[30, 40, 50, 60, 70, 80, 90].map((x) => (
          <line key={x} x1={x} y1="16" x2={x} y2="66" />
        ))}
        {[26, 36, 46, 56].map((y) => (
          <line key={y} x1="20" y1={y} x2="100" y2={y} />
        ))}
      </g>
      <path d="M 30 86 Q 54 60 78 34" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
      <circle cx="78" cy="34" r="5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.6" />
      <rect x="6" y="70" width="40" height="16" rx="8" fill="var(--accent)" />
      <text x="26" y="81.5" textAnchor="middle" fontSize="9" fontFamily="var(--mono)" fill="var(--on-accent)">xG</text>
    </svg>
  )
}

export function TapZoneArt() {
  return (
    <svg viewBox="0 0 120 80" className="empty-art" aria-hidden="true">
      <g fill="var(--surface-2)" stroke="var(--line)">
        {[0, 1, 2].map((c) =>
          [0, 1].map((r) => <rect key={`${c}${r}`} x={14 + c * 32} y={8 + r * 32} width="28" height="28" rx="4" />),
        )}
      </g>
      <rect x="46" y="40" width="28" height="28" rx="4" fill="var(--seq-4)" className="tap-cell" />
      <path
        d="M 70 52 l 0 18 l 5 -4 l 4 9 l 4 -2 l -4 -9 l 6 -1 z"
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        className="tap-cursor"
      />
    </svg>
  )
}

export function OffsideArt() {
  return (
    <svg viewBox="0 0 160 110" className="error-art" aria-hidden="true">
      <rect x="10" y="20" width="140" height="80" rx="10" fill="var(--pitch)" />
      <line x1="80" y1="20" x2="80" y2="100" stroke="var(--pitch-line)" strokeWidth="1.5" />
      <rect x="112" y="6" width="4" height="40" rx="1" fill="var(--ink)" />
      <path d="M 116 8 L 142 8 L 142 26 L 116 26 Z" fill="var(--accent)" className="flag" />
      <circle cx="52" cy="66" r="9" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M 47 62 L 57 70 M 57 62 L 47 70" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="logo" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
      <rect x="6" y="9" width="20" height="14" rx="2" fill="none" stroke="var(--on-accent)" strokeWidth="1.6" />
      <line x1="16" y1="9" x2="16" y2="23" stroke="var(--on-accent)" strokeWidth="1.6" />
      <circle cx="21" cy="14" r="2.6" fill="var(--on-accent)" />
    </svg>
  )
}
