/**
 * Ocean Shape Components
 *
 * All shapes use the palette colors:
 *   #0A1E38  — depth (darkest, for silhouettes)
 *   #082840  — abyss
 *   #0E5480  — ocean
 *   #7FFFD4  — accent (windows, highlights)
 *   rgba(255,255,255,0.x) — sails, reflections
 *
 * Each shape is a pure SVG — no state, no effects.
 * They're rendered inside <FloatingElement> which handles position + animation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BOAT — Homepage
// ─────────────────────────────────────────────────────────────────────────────
export function Boat() {
  return (
    <svg width="72" height="52" viewBox="0 0 72 52" fill="none">
      {/* Hull */}
      <path d="M6,30 Q8,42 36,44 Q64,42 66,30 Z" fill="#0A1E38" />
      <path d="M6,30 Q8,42 36,44 Q64,42 66,30"
        stroke="rgba(255,255,255,0.18)" strokeWidth="1" fill="none" />
      {/* Cabin */}
      <rect x="24" y="22" width="24" height="10" rx="2" fill="#0D2840" />
      <rect x="24" y="22" width="24" height="10" rx="2"
        stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" fill="none" />
      {/* Cabin windows */}
      <rect x="27" y="24.5" width="6" height="5" rx="1" fill="rgba(127,255,212,0.35)" />
      <rect x="39" y="24.5" width="6" height="5" rx="1" fill="rgba(127,255,212,0.25)" />
      {/* Mast */}
      <line x1="36" y1="22" x2="36" y2="2"
        stroke="#0A1E38" strokeWidth="1.8" strokeLinecap="round" />
      {/* Main sail */}
      <path d="M36,3 L58,20 L36,21 Z" fill="rgba(255,255,255,0.82)" />
      {/* Jib sail */}
      <path d="M36,6 L18,20 L36,20 Z" fill="rgba(255,255,255,0.55)" />
      {/* Water ripple */}
      <path d="M10,44 Q22,47 36,45 Q50,43 62,46"
        stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FISH — Login / Register  (small, friendly, teal-blue)
// ─────────────────────────────────────────────────────────────────────────────
export function Fish() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" fill="none">
      {/* Body */}
      <ellipse cx="30" cy="20" rx="22" ry="12" fill="#5EB6C8" />
      {/* Tail fin */}
      <path d="M8,20 L0,8 L0,32 Z" fill="#2E98BA" />
      {/* Top fin */}
      <path d="M22,8 Q30,2 38,8" stroke="#1878A0" strokeWidth="2.5"
        strokeLinecap="round" fill="none" />
      {/* Eye */}
      <circle cx="46" cy="17" r="3.5" fill="white" />
      <circle cx="47" cy="17" r="1.8" fill="#0A1E38" />
      {/* Mouth */}
      <path d="M54,21 Q56,23 54,25" stroke="#0E5480" strokeWidth="1.5"
        strokeLinecap="round" fill="none" />
      {/* Scale lines */}
      <path d="M28,12 Q30,20 28,28" stroke="rgba(255,255,255,0.25)"
        strokeWidth="1" fill="none" />
      <path d="M20,13 Q22,20 20,27" stroke="rgba(255,255,255,0.18)"
        strokeWidth="1" fill="none" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARK — Dashboard  (sleek, dark, powerful)
// ─────────────────────────────────────────────────────────────────────────────
export function Shark() {
  return (
    <svg
      width="92"
      height="44"
      viewBox="0 0 92 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shark body */}
      <path
        d="
          M4 24
          Q14 12 34 10
          L46 2
          L50 11
          Q62 10 72 16
          Q58 18 48 22
          L60 34
          L40 25
          Q20 30 4 24
          Z
        "
        fill="black"
      />

      {/* Tail */}
      <path
        d="
          M68 19
          L84 8
          L78 20
          L90 30
          L70 25
          Z
        "
        fill="black"
      />

      {/* Bottom fin */}
      <path
        d="
          M34 23
          L24 36
          L42 28
          Z
        "
        fill="black"
      />

      {/* Eye */}
      <circle
        cx="18"
        cy="18"
        r="1.5"
        fill="white"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTHOUSE — Stocks page
// ─────────────────────────────────────────────────────────────────────────────
export function Lighthouse() {
  return (
    <svg width="44" height="80" viewBox="0 0 44 80" fill="none">
      {/* Base rocks */}
      <ellipse cx="22" cy="76" rx="20" ry="5" fill="#082840" />
      {/* Tower */}
      <path d="M12,72 L10,30 L34,30 L32,72 Z" fill="#0A1E38" />
      {/* Tower stripes */}
      <rect x="10" y="42" width="24" height="6" rx="1"
        fill="rgba(255,255,255,0.12)" />
      <rect x="11" y="56" width="22" height="6" rx="1"
        fill="rgba(255,255,255,0.10)" />
      {/* Lamp room */}
      <rect x="8" y="20" width="28" height="12" rx="3" fill="#0E5480" />
      {/* Lamp room windows */}
      <rect x="12" y="22" width="8" height="8" rx="2"
        fill="rgba(127,255,212,0.55)" />
      <rect x="24" y="22" width="8" height="8" rx="2"
        fill="rgba(127,255,212,0.35)" />
      {/* Light glow */}
      <circle cx="22" cy="14" r="8" fill="rgba(127,255,212,0.15)" />
      <circle cx="22" cy="14" r="4" fill="rgba(127,255,212,0.50)" />
      {/* Roof */}
      <path d="M6,20 L22,8 L38,20 Z" fill="#082840" />
      {/* Railing */}
      <rect x="6" y="30" width="32" height="2" rx="1"
        fill="rgba(255,255,255,0.25)" />
      {/* Beacon rays */}
      <line x1="22" y1="8" x2="4" y2="0" stroke="rgba(127,255,212,0.30)"
        strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="8" x2="40" y2="0" stroke="rgba(127,255,212,0.20)"
        strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PIRATE SKULL — Stock detail /stocks/[ticker]  (warning, risk)
// ─────────────────────────────────────────────────────────────────────────────
export function PirateSkull() {
  return (
    <svg width="58" height="62" viewBox="0 0 58 62" fill="none">
      {/* Skull dome */}
      <path d="M8,36 Q8,10 29,10 Q50,10 50,36 L50,44 L8,44 Z" fill="#0A1E38" />
      {/* Jaw */}
      <rect x="12" y="43" width="34" height="12" rx="4" fill="#0D2840" />
      {/* Teeth */}
      <rect x="14" y="43" width="5" height="8" rx="1" fill="rgba(255,255,255,0.70)" />
      <rect x="22" y="43" width="5" height="8" rx="1" fill="rgba(255,255,255,0.70)" />
      <rect x="30" y="43" width="5" height="8" rx="1" fill="rgba(255,255,255,0.70)" />
      <rect x="38" y="43" width="5" height="8" rx="1" fill="rgba(255,255,255,0.70)" />
      {/* Eye sockets */}
      <ellipse cx="19" cy="30" rx="7" ry="8" fill="#C5E2E0" opacity="0.85" />
      <ellipse cx="39" cy="30" rx="7" ry="8" fill="#C5E2E0" opacity="0.85" />
      {/* Pupils */}
      <ellipse cx="19" cy="30" rx="4" ry="5" fill="#082840" />
      <ellipse cx="39" cy="30" rx="4" ry="5" fill="#082840" />
      {/* Nose cavity */}
      <path d="M25,38 L29,32 L33,38 Z" fill="#082840" />
      {/* Crossed bones below */}
      <line x1="4" y1="56" x2="54" y2="56"
        stroke="#0A1E38" strokeWidth="6" strokeLinecap="round" />
      <line x1="4" y1="56" x2="54" y2="56"
        stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TREASURE CHEST — Automated Watchlist
// ─────────────────────────────────────────────────────────────────────────────
export function TreasureChest() {
  return (
    <svg width="68" height="56" viewBox="0 0 68 56" fill="none">
      {/* Chest body */}
      <rect x="4" y="28" width="60" height="24" rx="4" fill="#0A1E38" />
      {/* Chest lid */}
      <path d="M4,28 Q4,14 34,14 Q64,14 64,28 Z" fill="#0E5480" />
      {/* Lid arc highlight */}
      <path d="M10,28 Q10,18 34,18 Q58,18 58,28"
        stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
      {/* Metal bands — horizontal */}
      <rect x="4" y="36" width="60" height="4" rx="2" fill="#082840" />
      {/* Lock plate */}
      <rect x="27" y="26" width="14" height="10" rx="2" fill="#1878A0" />
      <circle cx="34" cy="31" r="3" fill="#7FFFD4" opacity="0.6" />
      {/* Gold coins spilling */}
      <circle cx="20" cy="28" r="3" fill="rgba(255,213,128,0.70)" />
      <circle cx="28" cy="25" r="2.5" fill="rgba(255,213,128,0.60)" />
      <circle cx="46" cy="26" r="3" fill="rgba(255,213,128,0.65)" />
      <circle cx="52" cy="28" r="2" fill="rgba(255,213,128,0.50)" />
      {/* Corner rivets */}
      <circle cx="8" cy="32" r="2" fill="#0E5480" />
      <circle cx="60" cy="32" r="2" fill="#0E5480" />
      <circle cx="8" cy="48" r="2" fill="#0E5480" />
      <circle cx="60" cy="48" r="2" fill="#0E5480" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TURTLE — Watchlist A & B
// ─────────────────────────────────────────────────────────────────────────────
export function Turtle() {
  return (
    <svg width="72" height="52" viewBox="0 0 72 52" fill="none">
      {/* Shell */}
      <ellipse cx="36" cy="28" rx="22" ry="16" fill="#0E5480" />
      {/* Shell pattern */}
      <ellipse cx="36" cy="28" rx="14" ry="10"
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <line x1="36" y1="18" x2="36" y2="38"
        stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      <line x1="22" y1="28" x2="50" y2="28"
        stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      {/* Head */}
      <ellipse cx="58" cy="24" rx="8" ry="6" fill="#1878A0" />
      {/* Eye */}
      <circle cx="62" cy="22" r="2" fill="white" />
      <circle cx="63" cy="22" r="1" fill="#0A1E38" />
      {/* Mouth smile */}
      <path d="M58,27 Q61,30 64,27" stroke="rgba(255,255,255,0.40)"
        strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {/* Front flippers */}
      <path d="M18,20 Q8,12 4,18 Q10,22 18,24 Z" fill="#0E5480" />
      <path d="M18,36 Q8,42 4,36 Q10,32 18,32 Z" fill="#0E5480" />
      {/* Back flippers */}
      <path d="M54,20 Q62,12 66,18 Q60,22 54,24 Z" fill="#1878A0" opacity="0.6"/>
      {/* Tail */}
      <path d="M14,28 L4,28" stroke="#0E5480" strokeWidth="4"
        strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCHOR — Portfolio
// ─────────────────────────────────────────────────────────────────────────────
export function Anchor() {
  return (
    <svg width="52" height="72" viewBox="0 0 52 72" fill="none">
      {/* Ring at top */}
      <circle cx="26" cy="10" r="8" fill="none"
        stroke="#0A1E38" strokeWidth="4" />
      {/* Vertical shaft */}
      <line x1="26" y1="18" x2="26" y2="60"
        stroke="#0A1E38" strokeWidth="4" strokeLinecap="round" />
      {/* Crossbar */}
      <line x1="8" y1="28" x2="44" y2="28"
        stroke="#0A1E38" strokeWidth="4" strokeLinecap="round" />
      {/* Left curve bottom */}
      <path d="M26,60 Q10,60 8,48"
        stroke="#0A1E38" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Right curve bottom */}
      <path d="M26,60 Q42,60 44,48"
        stroke="#0A1E38" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Left ball */}
      <circle cx="8" cy="46" r="5" fill="#0E5480" />
      {/* Right ball */}
      <circle cx="44" cy="46" r="5" fill="#0E5480" />
      {/* Accent glow on ring */}
      <circle cx="26" cy="10" r="4" fill="rgba(127,255,212,0.25)" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMARINE — Trades
// ─────────────────────────────────────────────────────────────────────────────
export function Submarine() {
  return (
    <svg width="96" height="52" viewBox="0 0 96 52" fill="none">
      {/* Main hull */}
      <ellipse cx="46" cy="32" rx="38" ry="14" fill="#0A1E38" />
      {/* Conning tower */}
      <rect x="36" y="14" width="20" height="18" rx="4" fill="#082840" />
      {/* Tower top curve */}
      <path d="M36,18 Q46,10 56,18 Z" fill="#0E5480" />
      {/* Periscope */}
      <line x1="50" y1="10" x2="50" y2="2"
        stroke="#0A1E38" strokeWidth="3" strokeLinecap="round" />
      <rect x="46" y="0" width="8" height="4" rx="1" fill="#0E5480" />
      {/* Porthole windows */}
      <circle cx="28" cy="32" r="5" fill="#0E5480" />
      <circle cx="28" cy="32" r="3" fill="rgba(127,255,212,0.35)" />
      <circle cx="44" cy="32" r="5" fill="#0E5480" />
      <circle cx="44" cy="32" r="3" fill="rgba(127,255,212,0.25)" />
      <circle cx="60" cy="32" r="5" fill="#0E5480" />
      <circle cx="60" cy="32" r="3" fill="rgba(127,255,212,0.20)" />
      {/* Propeller */}
      <circle cx="84" cy="32" r="4" fill="#0E5480" />
      <ellipse cx="84" cy="24" rx="3" ry="6" fill="#0E5480" />
      <ellipse cx="84" cy="40" rx="3" ry="6" fill="#0E5480" />
      {/* Nose */}
      <ellipse cx="10" cy="32" rx="6" ry="10" fill="#0E5480" />
      {/* Bubble trail */}
      <circle cx="90" cy="22" r="2" fill="rgba(255,255,255,0.15)" />
      <circle cx="94" cy="16" r="1.5" fill="rgba(255,255,255,0.10)" />
      <circle cx="88" cy="12" r="1" fill="rgba(255,255,255,0.08)" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OCTOPUS — Profile
// ─────────────────────────────────────────────────────────────────────────────
export function Octopus() {
  return (
    <svg width="72" height="80" viewBox="0 0 72 80" fill="none">
      {/* Head/mantle */}
      <ellipse cx="36" cy="26" rx="22" ry="20" fill="#0E5480" />
      {/* Mantle highlight */}
      <ellipse cx="30" cy="18" rx="10" ry="8"
        fill="rgba(255,255,255,0.08)" />
      {/* Eyes */}
      <circle cx="26" cy="22" r="5" fill="white" />
      <circle cx="46" cy="22" r="5" fill="white" />
      <circle cx="27" cy="22" r="3" fill="#0A1E38" />
      <circle cx="47" cy="22" r="3" fill="#0A1E38" />
      {/* Eye shine */}
      <circle cx="28" cy="20" r="1" fill="rgba(127,255,212,0.80)" />
      <circle cx="48" cy="20" r="1" fill="rgba(127,255,212,0.80)" />
      {/* Smile */}
      <path d="M28,32 Q36,38 44,32" stroke="rgba(255,255,255,0.35)"
        strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* 8 tentacles — curvy paths from base of head */}
      <path d="M16,42 Q6,52 8,64 Q10,72 14,68 Q16,60 12,52 Q18,56 20,64"
        stroke="#1878A0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M22,44 Q16,56 18,68 Q20,76 24,72 Q24,62 20,54"
        stroke="#1878A0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M30,46 Q28,60 30,72 Q32,78 36,74 Q34,62 32,50"
        stroke="#1878A0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M42,46 Q44,60 42,72 Q40,78 36,74 Q38,62 40,50"
        stroke="#1878A0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M50,44 Q56,56 54,68 Q52,76 48,72 Q48,62 52,54"
        stroke="#1878A0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M56,42 Q66,52 64,64 Q62,72 58,68 Q56,60 60,52 Q54,56 52,64"
        stroke="#1878A0" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Suckers on two front tentacles */}
      <circle cx="10" cy="60" r="1.5" fill="rgba(255,255,255,0.20)" />
      <circle cx="62" cy="60" r="1.5" fill="rgba(255,255,255,0.20)" />
    </svg>
  )
}