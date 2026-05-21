import type { Config } from 'tailwindcss'

/**
 * AlgoWealth Tailwind Config
 * Extends Tailwind with our design token palette so we can use
 * classes like `text-accent`, `bg-ocean`, `border-abyss` anywhere.
 * All values mirror the CSS variables in globals.css — one source of truth.
 */
const config: Config = {
  // Only generate classes for files that actually use them
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      // ── Color Palette ──────────────────────────────────
      colors: {
        // Raw palette — matches CSS variables
        sky:        '#C2D8D6',
        mist:       '#84C8D2',
        'wave-light': '#5EB6C8',
        'wave-mid':   '#2E98BA',   // primary brand
        'wave-deep':  '#1878A0',
        ocean:      '#0E5480',
        abyss:      '#082840',
        depth:      '#0A1E38',

        // Accent
        accent:     '#7FFFD4',

        // Status
        profit:     '#7FFFD4',
        loss:       '#FF6B8A',
        warning:    '#FFD580',
      },

      // ── Typography ─────────────────────────────────────
      fontFamily: {
        body:    ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['DM Serif Display', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ── Font Sizes ─────────────────────────────────────
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs:    ['11px', { lineHeight: '16px' }],
        sm:    ['13px', { lineHeight: '20px' }],
        base:  ['14px', { lineHeight: '22px' }],
        md:    ['15px', { lineHeight: '24px' }],
        lg:    ['17px', { lineHeight: '26px' }],
        xl:    ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
      },

      // ── Spacing ────────────────────────────────────────
      spacing: {
        sidebar: '220px',   // matches --sidebar-width
      },

      // ── Border Radius ──────────────────────────────────
      borderRadius: {
        sm:   '6px',
        md:   '10px',
        lg:   '16px',
        xl:   '24px',
        full: '9999px',
      },

      // ── Box Shadows ────────────────────────────────────
      boxShadow: {
        sm:   '0 1px 3px rgba(8, 40, 64, 0.4)',
        md:   '0 4px 16px rgba(8, 40, 64, 0.5)',
        lg:   '0 8px 32px rgba(8, 40, 64, 0.6)',
        glow: '0 0 20px rgba(127, 255, 212, 0.15)',
      },

      // ── Backdrop Blur ──────────────────────────────────
      backdropBlur: {
        sm:  '8px',
        md:  '16px',
        lg:  '24px',
      },

      // ── Background Gradients (via backgroundImage) ─────
      backgroundImage: {
        // Main app background — used in dashboard layout
        'app-bg': `linear-gradient(160deg,
          rgba(14, 84, 128, 0.12) 0%,
          #082840 40%
        )`,
        // Sidebar gradient
        'sidebar-bg': `linear-gradient(180deg,
          rgba(10, 30, 56, 0.95) 0%,
          rgba(8, 40, 64, 0.98) 100%
        )`,
        // Card shimmer for skeleton loading
        'skeleton': `linear-gradient(90deg,
          rgba(255,255,255,0.04) 0%,
          rgba(255,255,255,0.08) 50%,
          rgba(255,255,255,0.04) 100%
        )`,
        // Accent gradient — used for highlights
        'accent-gradient': `linear-gradient(135deg,
          #7FFFD4 0%,
          #84C8D2 100%
        )`,
      },

      // ── Animations ─────────────────────────────────────
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.35', transform: 'scale(0.75)' },
        },
        'skeleton-shimmer': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'bob': {
          '0%, 100%': { transform: 'translate(-50%, -50%) rotate(0deg) translateY(0px)' },
          '25%':      { transform: 'translate(-50%, -50%) rotate(1.5deg) translateY(-6px)' },
          '75%':      { transform: 'translate(-50%, -50%) rotate(-1deg) translateY(4px)' },
        },
      },

      animation: {
        'fade-in':          'fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left':    'slide-in-left 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-up':      'slide-in-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'live-pulse':       'live-pulse 2s ease-in-out infinite',
        'skeleton-shimmer': 'skeleton-shimmer 1.8s ease-in-out infinite',
        'bob':              'bob 3.5s ease-in-out infinite',
      },

      // ── Transitions ────────────────────────────────────
      transitionTimingFunction: {
        'out-expo':  'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring':    'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      transitionDuration: {
        fast:   '150ms',
        normal: '250ms',
        slow:   '400ms',
      },
    },
  },

  plugins: [],
}

export default config