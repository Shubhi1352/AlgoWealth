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
    <svg width="92" height="40" viewBox="0 0 92 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shark body */}
      <path d="M4 24 Q14 12 34 10 L46 2 L45 9 Q62 10 72 16 Q58 18 48 22 L60 34 L40 25 Q20 30 4 24 Z" fill="black" />
      {/* Tail */}
      <path d="M68 15 L84 1 L78 15 L84 23" fill="black" />
      {/* Bottom fin */}
      <path d="M34 23 L37 36 L42 25 Z" fill="black" />
      {/* Eye */}
      <circle cx="18" cy="18" r="1.5" fill="white" />
      {/* Bottom fin */}
      <path d="M34 23 L37 36 L42 25 Z" fill="black" />
      {/* Eye */}
      <circle cx="18" cy="18" r="1.5" fill="white" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTHOUSE — Stocks page
// ─────────────────────────────────────────────────────────────────────────────
export function Lighthouse() {
  return (
    <svg width="48" height="72" viewBox="0 0 48 72" fill="none">
      <ellipse cx="24" cy="64" rx="15" ry="2" fill="#EEDB8C" />

      <path d="M18 62 L20 28 L28 28 L30 62 Z" fill="#D6D6D6" />

      <rect x="19" y="40" width="10" height="4" fill="#C0C0C0" />
      <rect x="19" y="52" width="10" height="4" fill="#C0C0C0" />

      <path d="M16 28 L14 22 L34 22 L32 28 Z" fill="#BDBDBD" />

      <rect x="14" y="18" width="20" height="10" rx="1" fill="#0F2F4A" />

      <rect x="16" y="19" width="5" height="8" fill="#8ED7E8" />
      <rect x="22" y="19" width="4" height="8" fill="#8ED7E8" />
      <rect x="27" y="19" width="5" height="8" fill="#8ED7E8" />

      <rect x="13" y="17" width="22" height="2" rx="1" fill="#0F2F4A" />
      <rect x="13" y="27" width="22" height="2" rx="1" fill="#0F2F4A" />

      <path d="M18 17 L20 12 L28 12 L30 17 Z" fill="#7D7D7D" />

      <path d="M2 67 C8 63 14 67 20 65 C28 63 34 69 46 64" stroke="#1670D1" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M2 68 C8 64 14 68 20 66 C28 64 34 70 46 65" stroke="#1670D1" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIRATE SKULL — Stock detail /stocks/[ticker]  (warning, risk)
// ─────────────────────────────────────────────────────────────────────────────
export function PirateSkull() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Bones
      <g fill="#000">
        <rect x="10" y="30" width="28" height="4" rx="2" transform="rotate(-30 24 32)" />
        <rect x="10" y="30" width="28" height="4" rx="2" transform="rotate(30 24 32)" />

        <circle cx="10" cy="32" r="3" />
        <circle cx="14" cy="28" r="3" />
        <circle cx="34" cy="36" r="3" />
        <circle cx="38" cy="32" r="3" />

        <circle cx="38" cy="32" r="3" />
        <circle cx="34" cy="28" r="3" />
        <circle cx="10" cy="36" r="3" />
        <circle cx="14" cy="40" r="3" />
      </g> */}

      {/* Skull */}
      <path
        d="M24 4C15 4 10 10 10 18C10 24 13 28 17 30V35L20 38H28L31 35V30C35 28 38 24 38 18C38 10 33 4 24 4Z"
        fill="#adadadec"
      />

      {/* Eyes */}
      <ellipse cx="18" cy="22" rx="4.5" ry="4.0" fill="black" transform="rotate(20 18 19)" />
      <ellipse cx="30" cy="22" rx="4.5" ry="4.0" fill="black" transform="rotate(-20 30 19)" />

      {/* Nose */}
      <path d="M24 24L21 29H27L24 24Z" fill="black" />

      {/* Teeth */}
      <rect x="19" y="32" width="10" height="4" fill="black" />
      <line x1="22" y1="32" x2="22" y2="35" stroke="#adadadec" />
      <line x1="24" y1="32" x2="24" y2="35" stroke="#adadadec" />
      <line x1="26" y1="32" x2="26" y2="35" stroke="#adadadec" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREASURE CHEST — Automated Watchlist
// ─────────────────────────────────────────────────────────────────────────────
export function TreasureChest() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" fill="none">
      {/* Lid back */}
      <path d="M19 8 L50 8 L57 18 L24 18 Z" fill="#6D4A1F" stroke="#E0A92E" strokeWidth="1.5" />

      {/* Lid side */}
      <path d="M19 8 L15 19 L24 18 Z" fill="#5B3D18" stroke="#E0A92E" strokeWidth="1.5" />

      {/* Gold pile */}
      <ellipse cx="24" cy="20" rx="4" ry="1.5" fill="#F7C948" />
      <ellipse cx="30" cy="20" rx="4" ry="1.5" fill="#F7C948" />
      <ellipse cx="36" cy="20" rx="4" ry="1.5" fill="#F7C948" />
      <ellipse cx="42" cy="20" rx="4" ry="1.5" fill="#F7C948" />
      <ellipse cx="48" cy="23" rx="4" ry="1.5" fill="#F7C948" />

      {/* Front face */}
      <rect x="18" y="26" width="38" height="20" fill="#7B5324" stroke="#E0A92E" strokeWidth="1.5" />

      {/* Side face */}
      <path d="M15 20 L22 26 L22 46 L15 40 Z" fill="#65431C" stroke="#E0A92E" strokeWidth="1.5" />

      {/* Top face */}
      <path d="M16 20 L48 19 L55 26 L22 26 Z" fill="#9B6A2E" stroke="#E0A92E" strokeWidth="1.5" />

      {/* Wood planks */}
      <rect x="24" y="30" width="31" height="4" fill="#6A451D" />
      <rect x="24" y="38" width="31" height="4" fill="#6A451D" />

      {/* Lock plate */}
      <path d="M33 24 L43 24 L43 34 Q43 38 38 38 Q33 38 33 34 Z" fill="#F7C948" />

      {/* Keyhole */}
      <circle cx="38" cy="29" r="1.4" fill="#222" />
      <path d="M38 30.5 L36.7 34 L39.3 34 Z" fill="#222" />

      {/* Coins */}
      <ellipse cx="20" cy="50" rx="2.5" ry="1.5" fill="#F7C948" />
      <ellipse cx="26" cy="48" rx="2.5" ry="1.5" fill="#F7C948" />
      <ellipse cx="32" cy="51" rx="2.5" ry="1.5" fill="#F7C948" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TURTLE — Watchlist A & B
// ─────────────────────────────────────────────────────────────────────────────
export function Turtle() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Legs - reduced size */}
      <ellipse cx="22" cy="16" rx="4" ry="8" fill="#43693d" transform="rotate(-35 22 16)" />
      <ellipse cx="22" cy="48" rx="4" ry="8" fill="#43693d" transform="rotate(35 22 48)" />
      <ellipse cx="42" cy="16" rx="4" ry="8" fill="#43693d" transform="rotate(35 42 16)" />
      <ellipse cx="42" cy="48" rx="4" ry="8" fill="#43693d" transform="rotate(-35 42 48)" />

      {/* Tail */}
      <path d="M6 32 L14 29 L14 35Z" fill="#43693d" />

      {/* Head */}
      <ellipse cx="56" cy="32" rx="8" ry="6" fill="#43693d" />
      <circle cx="58" cy="29.5" r="1" fill="white" />
      <circle cx="58" cy="34.5" r="1" fill="white" />

      {/* Shell */}
      <ellipse cx="32" cy="32" rx="20" ry="18" fill="#43693d" />
      <ellipse cx="32" cy="32" rx="20" ry="18" stroke="grey" strokeWidth="1" />

      {/* Center hexagon */}
      <path
        d="M32 23 L38 27 L38 37 L32 41 L26 37 L26 27 Z"
        stroke="grey"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* Top panels */}
      <path d="M26 27 L19 21" stroke="grey" strokeWidth="1" strokeLinecap="round" />
      <path d="M38 27 L45 21" stroke="grey" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 23 L32 15" stroke="grey" strokeWidth="1" strokeLinecap="round" />

      {/* Side panels */}
      <path d="M26 37 L19 43" stroke="grey" strokeWidth="1" strokeLinecap="round" />
      <path d="M38 37 L45 43" stroke="grey" strokeWidth="1" strokeLinecap="round" />

      {/* Bottom panel */}
      <path d="M32 41 L32 49" stroke="grey" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCHOR — Portfolio
// ─────────────────────────────────────────────────────────────────────────────
export function Anchor() {
  return (
    <svg width="55" height="55" viewBox="0 0 55 55" fill="none">
      {/* Ring */}
      <circle cx="24" cy="7" r="3.5" stroke="#0A4568" strokeWidth="2.5" />

      {/* Shank */}
      <path d="M24 10.5V35" stroke="#0A4568" strokeWidth="3" strokeLinecap="round" />

      {/* Crossbar */}
      <path d="M15 17H33" stroke="#0A4568" strokeWidth="3" strokeLinecap="round" />

      {/* Anchor arms */}
      <path
        d="M24 35 C20 34 10 31 9 22 C8 23 8 24 8 25"
        stroke="#0A4568"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M24 35 C28 34 38 31 39 22 C40 23 40 24 40 25"
        stroke="#0A4568"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom point */}
      <path d="M24 42 L18 36 H30 L24 42Z" fill="#0A4568" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMARINE — Trades
// ─────────────────────────────────────────────────────────────────────────────
export function Submarine() {
  return (
    <svg width="72" height="52" viewBox="0 0 72 52" fill="none">
      {/* Periscope */}
      <rect x="34" y="2" width="3" height="8" rx="1.5" fill="#0E4F75" />

      {/* Tower */}
      <path
        d="M26 18C26 12 30 8 36 8C42 8 46 12 46 18V22H26V18Z"
        fill="#0E4F75"
      />

      {/* Main body */}
      <path
        d="
          M12 36
          C4 36 2 16 16 16
          H50
          L66 22
          L66 29
          L50 36
          Z
        "
        fill="#0E4F75"
      />

      {/* Tail */}
      <rect x="64" y="18" width="5" height="16" fill="#0E4F75" />

      {/* Windows */}
      <circle cx="24" cy="26" r="3" fill="#E8F8FF" />
      <circle cx="36" cy="26" r="3" fill="#E8F8FF" />
      <circle cx="48" cy="26" r="3" fill="#E8F8FF" />

      {/* Small bubbles */}
      <circle cx="58" cy="12" r="1.2" fill="rgba(255,255,255,0.5)" />
      <circle cx="63" cy="8" r="0.8" fill="rgba(255,255,255,0.35)" />
      <circle cx="66" cy="14" r="0.9" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OCTOPUS — Profile
// ─────────────────────────────────────────────────────────────────────────────
export function Octopus() {
  return (
    <svg width="80" height="80" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      
      {/* Tentacles - drawn behind body */}
      {/* Far left tentacle curling */}
      <path d="M75,120 Q40,140 35,165 Q33,180 50,178 Q60,176 55,165"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Left tentacle */}
      <path d="M80,130 Q60,160 70,185 Q75,195 85,188 Q88,175 80,165"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Left-center tentacle */}
      <path d="M95,140 Q90,170 100,190 Q108,198 112,188 Q110,175 105,165"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Center-right tentacle */}
      <path d="M120,140 Q128,170 120,190 Q115,198 110,188 Q112,175 118,165"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Right tentacle */}
      <path d="M135,135 Q160,160 155,185 Q150,195 140,188 Q138,175 145,165"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Far right tentacle curling */}
      <path d="M145,125 Q180,140 188,165 Q190,180 173,178 Q163,176 168,165"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Back tentacle peeking left */}
      <path d="M85,115 Q55,115 45,135"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* Back tentacle peeking right */}
      <path d="M140,115 Q170,115 180,135"
        stroke="#1a5a6f" strokeWidth="14" strokeLinecap="round" fill="none" />

      {/* Head/body - bulbous, taller than wide */}
      <path d="M110,40 C75,40 62,70 65,100 C68,125 85,140 110,140 C135,140 152,125 155,100 C158,70 145,40 110,40 Z"
        fill="#1a5a6f" />

      {/* Eyes - large and close together */}
      <ellipse cx="97" cy="85" rx="9" ry="11" fill="white" />
      <ellipse cx="123" cy="85" rx="9" ry="11" fill="white" />

      {/* Pupils */}
      <ellipse cx="98" cy="87" rx="4" ry="5.5" fill="#0A1E38" />
      <ellipse cx="122" cy="87" rx="4" ry="5.5" fill="#0A1E38" />
    </svg>
  )
}