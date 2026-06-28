'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { TracePositionsProvider } from './contexts/TracePositionsContext'
import { ColorSchemeProvider } from './contexts/ColorSchemeContext'
import { ArchCursor } from './components/ArchCursor'
import { MouseImageTrail } from './components/MouseImageTrail'
import { ArtriumLogo } from './components/ArtriumLogo'

// ── Brand palette ────────────────────────────────────────────────────────────
const C = {
  espresso: '#3F3A36',
  coral:    '#F69C9F',
  gold:     '#FBF5AF',
  sky:      '#A2DEF8',
  cream:    '#FFF8F2',
  sage:     '#C8CFA0',
  offwhite: '#F8F8F8',
  medgray:  '#666666',
  dark:     '#111111',
}

// ── Real links ───────────────────────────────────────────────────────────────
const LINKS = {
  appStore:         'https://apps.apple.com/us/app/artriumnow/id6765523334',
  webApp:           'https://app.artrium.space',
  discord:          'https://discord.gg/JsMgwyAKM',
  linkedin:         'https://www.linkedin.com/company/artriumspace',
  collaborate:      'https://docs.google.com/forms/d/e/1FAIpQLSdB-cSRNlC6fPeJ_Nw67dN2TuAlNInpVVkPCwWiZM7BSYMXLA/viewform?usp=header',
  exhibitionSubmit: 'https://docs.google.com/forms/d/e/1FAIpQLSeXeG9x8zruZkR4tbHocaeHaxvlrXhz7qfU6hEYipwIIh8KQQ/viewform',
}

// ── Section data ─────────────────────────────────────────────────────────────
const DOORS = [
  {
    num:      '01',
    accentBg: C.gold,
    title:    'The app',
    desc:     'Find collaborators for your next project, join communities built around your craft and city, and land your next opportunity.',
    cta:      'Open the web app',
    href:     LINKS.webApp,
    external: true,
  },
  {
    num:      '02',
    accentBg: C.coral,
    title:    'The exhibition',
    desc:     'A rotating online show of work from artists across the Artrium community. New rooms, new artists, no white walls required.',
    cta:      'Submit your work',
    href:     '/exhibition',
    external: false,
  },
  {
    num:      '03',
    accentBg: C.sky,
    title:    'The map',
    desc:     'Every studio, gallery, materials shop, and open call across your city, plotted in one place. Built by the community, for the community.',
    cta:      'Explore the map',
    href:     '/map',
    external: false,
  },
]

const EXHIBITIONS = [
  { title: 'Submit your work',         venue: 'Open to all Artrium artists',   dates: 'Accepting now', color: C.sage  },
  { title: 'Online exhibition space',  venue: 'Walk our 3D virtual gallery',   dates: 'Explore anytime', color: C.coral },
  { title: 'All mediums welcome',      venue: 'Painting, sculpture, digital', dates: 'No gallery required', color: C.sky   },
]

const MARQUEE_WORDS = [
  'ARTISTS', 'EXHIBITIONS', 'STUDIOS', 'COMMUNITIES',
  'OPEN CALLS', 'RESIDENCIES', 'COLLABORATORS', 'WORKSHOPS',
  'GALLERY', 'CREATIVE SPACES', 'ARTIST TALKS', 'NETWORKS',
]

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold)
    fn()
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [threshold])
  return scrolled
}

function usePastHero() {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const fn = () => setPast(window.scrollY > window.innerHeight * 0.75)
    fn()
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return past
}

function useReveal(direction: 'up' | 'left' | 'right' = 'up', delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const initial =
    direction === 'up'    ? 'translateY(28px)' :
    direction === 'left'  ? 'translateX(-32px)' :
                            'translateX(32px)'
  const revealStyle: React.CSSProperties = {
    opacity:    visible ? 1 : 0,
    transform:  visible ? 'none' : initial,
    transition: `opacity 0.75s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.75s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  }
  return { ref, revealStyle }
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function useCounter(target: number, active: boolean, suffix = '', duration = 1800) {
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.floor(eased * target).toLocaleString() + suffix)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active, target, suffix, duration])
  return display
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <ColorSchemeProvider>
      <HomeInner />
    </ColorSchemeProvider>
  )
}

function HomeInner() {
  const pastHero = usePastHero()
  return (
    <TracePositionsProvider>
      <div style={{ background: C.cream }}>
        <ArchCursor />
        <SiteNav />
        <HeroSection trailDisabled={pastHero} />
        <MarqueeBand />
        <ThreeDoorsSection />
        <StatsBar />
        <ExhibitionSection />
        <MapSection />
        <CommunitySection />
        <FooterSection />
      </div>
    </TracePositionsProvider>
  )
}

// ── Nav ────────────────────────────────────────────────────────────────────────
function SiteNav() {
  const scrolled = useScrolled()
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background:     scrolled ? C.espresso : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom:   scrolled ? `1px solid rgba(255,248,242,0.1)` : 'none',
        transform:      scrolled ? 'translateY(0)' : 'translateY(-100%)',
        opacity:        scrolled ? 1 : 0,
        transition:     'transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease, background-color 0.4s ease',
      }}
    >
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8 flex items-center justify-center h-16 sm:h-[72px]">
        <div className="flex gap-8 text-sm font-medium">
          {[
            { href: LINKS.appStore, label: 'App',        external: true  },
            { href: '/exhibition',  label: 'Exhibition', external: false },
            { href: '/map',         label: 'Map',        external: false },
            { href: LINKS.discord,  label: 'Community',  external: true  },
          ].map(({ href, label, external }) =>
            external ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="pb-0.5 border-b-2 border-transparent hover:border-current transition-all"
                style={{ color: C.cream, opacity: 0.75 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                href={href}
                className="pb-0.5 border-b-2 border-transparent hover:border-current transition-all"
                style={{ color: C.cream, opacity: 0.75 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
              >
                {label}
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  )
}

// Single connected serpentine path per arch — one continuous stroke that snakes through
// the interior. Q-bezier turns at each edge (rounded, not sharp) so when stroke-dashoffset
// reveals it with linear timing, you watch a single line scribble across the arch in real time.
const SCRIBBLE: Record<string, string> = [
  // Large gold arch (x=4–96, legs y=46–138, semicircle top center=(50,46) r=46)
  // Starts narrow at top of semicircle, widens into leg area, ~16 rows
  ['gold',
    'M 28,12 L 74,15',   'Q 103,16 97,22',  'L 4,19',
    'Q -4,19 4,26',      'L 93,30',          'Q 103,32 97,38',
    'L 4,35',            'Q -4,34 4,42',     'L 97,46',
    'Q 106,48 97,54',    'L 3,51',           'Q -5,50 3,58',
    'L 97,62',           'Q 106,64 97,70',   'L 3,67',
    'Q -5,66 3,74',      'L 97,78',          'Q 106,80 97,86',
    'L 3,83',            'Q -5,82 3,90',     'L 97,94',
    'Q 106,96 97,102',   'L 3,99',           'Q -5,98 3,106',
    'L 97,110',          'Q 106,112 97,118', 'L 3,115',
    'Q -5,114 3,122',    'L 97,126',         'Q 106,128 97,134',
    'L 3,131',
  ],
  // Medium coral arch (x=4–74, legs y=35–107, semicircle top center=(39,35) r=35)
  ['coral',
    'M 22,5 L 57,8',     'Q 80,9 74,16',    'L 5,13',
    'Q -4,12 4,19',      'L 71,23',          'Q 82,25 74,31',
    'L 4,28',            'Q -4,27 4,35',     'L 74,39',
    'Q 83,41 74,47',     'L 3,44',           'Q -4,43 3,51',
    'L 74,55',           'Q 83,57 74,63',    'L 3,60',
    'Q -4,59 3,67',      'L 74,71',          'Q 83,73 74,79',
    'L 3,76',            'Q -4,75 3,83',     'L 74,87',
    'Q 83,89 74,95',     'L 3,92',           'Q -4,91 3,99',
    'L 74,103',
  ],
  // Small sky arch (x=3–55, legs y=27–80, semicircle top center=(29,27) r=26)
  ['sky',
    'M 18,4 L 41,7',     'Q 62,8 55,14',    'L 4,11',
    'Q -5,10 3,17',      'L 52,21',          'Q 64,23 55,29',
    'L 3,26',            'Q -6,25 3,32',     'L 55,36',
    'Q 64,38 55,44',     'L 3,41',           'Q -6,40 3,47',
    'L 55,51',           'Q 64,53 55,59',    'L 3,56',
    'Q -6,55 3,62',      'L 55,66',          'Q 64,68 55,74',
    'L 3,71',            'Q -6,70 3,77',     'L 55,80',
  ],
].reduce<Record<string, string>>((acc, [key, ...cmds]) => {
  acc[key as string] = (cmds as string[]).join(' ')
  return acc
}, {})

// Two-phase doodle animation per arch:
//   Phase 1 — outline draws itself in one motion (organic easing, rough wobble filter)
//   Phase 2 — scribble fill sweeps through interior row by row (linear, same wobble character)
// Both use the same feTurbulence parameters so they feel like the same hand/marker.
function HeroArch({ pos, d, scribble, w, h, vb, color, sw, delay, dur, seed }: {
  pos: string; d: string; scribble: string;
  w: number; h: number; vb: string;
  color: string; sw: number; delay: number; dur: number; seed: number;
}) {
  const key = color.replace('#', '')
  const fo = `rfo-${key}`   // outline filter
  const fs = `rfs-${key}`   // scribble filter — same params, different seed
  return (
    <svg
      className={`pointer-events-none ${pos}`}
      width={w} height={h} viewBox={vb} fill="none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Outline: medium-scale fractal noise — organic hand wobble */}
        <filter id={fo} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.028" numOctaves="4" seed={seed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Scribble: same frequency/character as outline, different seed for variety */}
        <filter id={fs} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.028" numOctaves="4" seed={seed + 29} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <style>{`
        @keyframes ho-${key} {
          0%   { stroke-dashoffset: 1; stroke-opacity: 0;    }
          3%   { stroke-dashoffset: 1; stroke-opacity: 0.52; }
          28%  { stroke-dashoffset: 0; stroke-opacity: 0.52; }
          78%  { stroke-dashoffset: 0; stroke-opacity: 0.16; }
          93%  { stroke-dashoffset: 0; stroke-opacity: 0;    }
          100% { stroke-dashoffset: 1; stroke-opacity: 0;    }
        }
        @keyframes hs-${key} {
          0%   { stroke-dashoffset: 1; stroke-opacity: 0;    }
          29%  { stroke-dashoffset: 1; stroke-opacity: 0;    }
          31%  { stroke-dashoffset: 1; stroke-opacity: 0.28; }
          72%  { stroke-dashoffset: 0; stroke-opacity: 0.26; }
          80%  { stroke-dashoffset: 0; stroke-opacity: 0.12; }
          93%  { stroke-dashoffset: 0; stroke-opacity: 0;    }
          100% { stroke-dashoffset: 1; stroke-opacity: 0;    }
        }
      `}</style>

      {/* Phase 2 — scribble fill, starts right after outline finishes, linear sweep */}
      <path d={scribble} pathLength="1" filter={`url(#${fs})`} style={{
        fill: 'none', stroke: color, strokeWidth: 1.35,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        strokeDasharray: '1',
        animation: `hs-${key} ${dur}s linear ${delay}s infinite`,
      } as React.CSSProperties} />

      {/* Phase 1 — outline, one motion, organic easing */}
      <path d={d} pathLength="1" filter={`url(#${fo})`} style={{
        fill: 'none', stroke: color, strokeWidth: sw + 0.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        strokeDasharray: '1',
        animation: `ho-${key} ${dur}s cubic-bezier(0.25, 0, 0.5, 1) ${delay}s infinite`,
      } as React.CSSProperties} />
    </svg>
  )
}

function FooterLogo() {
  return (
    <svg width="130" height="22" viewBox="0 0 455.78 78.09" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M332.95,78.12c16.09,0,29.13-13.04,29.13-29.13v-29.13h-58.26v29.13c0,16.09,13.04,29.13,29.13,29.13Z" fill="#a4def8"/>
      <path d="M332.95,58.68c16.09,0,29.13-13.03,29.13-29.11V.46h-58.26v29.11c0,16.08,13.04,29.11,29.13,29.11Z" fill="#f69da0"/>
      <path d="M303.82,0v10.16c0,16.09,13.04,29.13,29.13,29.13s29.13-13.04,29.13-29.13V0h-58.26Z" fill="#faf5b1"/>
      <path d="M143.81,29.11c0-8.04-2.86-14.98-8.51-20.6C129.65,2.89,122.69.01,114.67.01h-28.6v75.2h4.49v-16.98h24.11c2.77,0,5.43-.33,7.87-.99l10.45,17.97h5.3l-11.37-19.57c3.01-1.38,5.83-3.38,8.36-5.91,5.65-5.64,8.51-12.56,8.51-20.6l.02-.02ZM139.32,29.11c0,6.76-2.44,12.61-7.24,17.42-4.79,4.79-10.67,7.23-17.44,7.23h-24.11V4.49h24.11c6.77,0,12.63,2.44,17.44,7.23,4.79,4.79,7.24,10.65,7.24,17.42v-.02Z" fill="#FFF8F2"/>
      <path d="M145.22,4.47h22.66v70.72h4.49V4.47h22.66V.01h-49.8v4.46Z" fill="#FFF8F2"/>
      <path d="M262.46,29.11c0-8.04-2.86-14.98-8.51-20.6C248.29,2.89,241.34.01,233.31.01h-28.6v75.2h4.49v-16.98h24.11c2.77,0,5.43-.33,7.87-.99l10.45,17.97h5.3l-11.37-19.57c3.01-1.38,5.83-3.38,8.36-5.91,5.65-5.64,8.51-12.56,8.51-20.6l.02-.02ZM257.97,29.11c0,6.76-2.44,12.61-7.24,17.42-4.79,4.79-10.67,7.23-17.44,7.23h-24.11V4.49h24.11c6.77,0,12.63,2.44,17.44,7.23,4.8,4.79,7.24,10.65,7.24,17.42v-.02Z" fill="#FFF8F2"/>
      <path d="M285.69.01h-4.49v75.2h4.49V.01Z" fill="#FFF8F2"/>
      <path d="M450.9.01l-32.77,45.24L385.22.01h-4.86v75.18h4.49V7.22l30.93,42.63h4.6l30.93-42.63v67.98h4.49V.01h-4.88Z" fill="#FFF8F2"/>
      <path d="M37.42,5.72l17.68,37.73,7.21,4.74L39.97.47l-.22-.46h-4.69L12.69,47.94l7.17-4.68L37.42,5.72Z" fill="#FFF8F2"/>
      <path d="M74.41,74.03c-1.74-3.8-3.06-6.79-3.92-8.72l-.33-.73c-1.85-4.22-3.08-7.01-5.63-10.48-.18-.29-.55-.77-1.3-1.67-6.25-7.36-15.71-11.6-25.93-11.6-11.2,0-22.52,5.73-27.52,13.95-1.3,2.15-3.65,6.92-4.93,9.6-1.54,3.18-3.01,6.44-4.38,9.69l-.48,1.14h4.95l1.94-4.15c1.12-2.44,2.24-4.85,3.41-7.27,1.56-3.21,3.39-6.57,6.33-9.42,2.29-2.22,4.82-4.06,7.48-5.47,4.07-2.15,8.64-3.29,13.22-3.32h.11c7.04,0,14.01,2.72,19.64,7.69,3.08,2.72,5.41,5.73,6.88,8.94l1.45,3.16c1.43,3.12,2.88,6.26,4.33,9.38l.22.48h4.99l-.53-1.16-.02-.04Z" fill="#FFF8F2"/>
    </svg>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function HeroSection({ trailDisabled }: { trailDisabled: boolean }) {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16"
      style={{
        background: C.espresso,
        backgroundImage: `
          repeating-linear-gradient(0deg,  transparent 0 64px, rgba(255,248,242,0.025) 64px 65px),
          repeating-linear-gradient(90deg, transparent 0 64px, rgba(255,248,242,0.025) 64px 65px)
        `,
      }}
    >
      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: 0.045,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Decorative arches — rough outline draws, then scribble fills interior */}
      <HeroArch pos="absolute top-28 left-6 xl:left-20 hidden sm:block"
        d="M 4,138 L 4,46 A 46,46 0 0,1 96,46 L 96,138" scribble={SCRIBBLE.gold}
        w={108} h={141} vb="-4 -3 108 141" color={C.gold}  sw={2.5} delay={0}    dur={9} seed={7} />
      <HeroArch pos="absolute bottom-32 right-6 xl:right-20 hidden sm:block"
        d="M 4,107 L 4,35 A 35,35 0 0,1 74,35 L 74,107" scribble={SCRIBBLE.coral}
        w={84}  h={110} vb="-3 -3 84 110"  color={C.coral} sw={2.2} delay={-3.2} dur={9} seed={23} />
      <HeroArch pos="absolute top-40 right-28 xl:right-60 hidden lg:block"
        d="M 3,80 L 3,27 A 26,26 0 0,1 55,27 L 55,80" scribble={SCRIBBLE.sky}
        w={64}  h={82}  vb="-3 -2 64 82"   color={C.sky}   sw={2.0} delay={-6.1} dur={9} seed={41} />

      <MouseImageTrail disabled={trailDisabled} />

      <div className="relative z-10 flex flex-col items-center w-full px-6 py-20">
        {/* Eyebrow */}
        <div
          className="text-xs font-bold tracking-[3.5px] uppercase mb-8"
          style={{ color: C.coral, animation: 'fadeSlideUp 0.8s ease 0.15s both' }}
        >
          One community. Three doors in.
        </div>

        {/* Interactive logo */}
        <div style={{ animation: 'fadeIn 1.1s ease 0.35s both', width: '100%', display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <ArtriumLogo />
        </div>

        {/* Headline */}
        <h1
          className="text-3xl sm:text-4xl md:text-[2.8rem] font-bold text-center leading-[1.1] mt-14"
          style={{
            color: C.cream,
            letterSpacing: '-1px',
            animation: 'fadeSlideUp 0.85s ease 0.55s both',
          }}
        >
          Where art finds its place.
        </h1>

        {/* Sub */}
        <p
          className="text-center text-sm sm:text-base mt-4 max-w-[480px] leading-[1.7]"
          style={{ color: `rgba(255,248,242,0.58)`, animation: 'fadeSlideUp 0.85s ease 0.75s both' }}
        >
          Find your people in the app, step into a rotating online exhibition, and discover every studio, gallery, and resource across your city.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-wrap gap-3 mt-8 justify-center"
          style={{ animation: 'fadeSlideUp 0.85s ease 0.9s both' }}
        >
          <a
            href={LINKS.webApp}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: C.cream, color: C.espresso }}
          >
            Open the web app
          </a>
          <a
            href={LINKS.appStore}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:-translate-y-0.5 border"
            style={{ borderColor: `rgba(255,248,242,0.28)`, color: C.cream }}
          >
            Download mobile app
          </a>
          <Link
            href="/exhibition"
            className="px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:-translate-y-0.5 border"
            style={{ borderColor: `rgba(255,248,242,0.28)`, color: C.cream }}
          >
            View Exhibition →
          </Link>
          <Link
            href="/map"
            className="px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:-translate-y-0.5 border"
            style={{ borderColor: `rgba(255,248,242,0.28)`, color: C.cream }}
          >
            View Map →
          </Link>
        </div>

        {/* Social proof */}
        <p
          className="mt-7 text-xs"
          style={{ color: `rgba(255,248,242,0.45)`, animation: 'fadeSlideUp 0.85s ease 1.1s both' }}
        >
          <span style={{ color: C.cream, fontWeight: 600 }}>100+</span> artists across{' '}
          <span style={{ color: C.cream, fontWeight: 600 }}>10+</span> cities, already in.
        </p>

        {/* Scroll cue */}
        <div className="mt-14" style={{ animation: 'fadeIn 1.2s ease 1.6s both' }}>
          <div className="flex flex-col items-center gap-5">
            <span className="text-[10px] font-bold tracking-[3px] uppercase" style={{ color: `rgba(255,248,242,0.3)` }}>
              Scroll
            </span>
            <div className="w-px h-10" style={{
              background: `linear-gradient(to bottom, rgba(255,248,242,0.35), transparent)`,
              animation: 'floatY 2.4s ease-in-out infinite',
            }} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Marquee ────────────────────────────────────────────────────────────────────
function MarqueeBand() {
  const items = [...MARQUEE_WORDS, ...MARQUEE_WORDS]
  return (
    <div
      className="overflow-hidden py-3.5 border-y"
      style={{ background: C.espresso, borderColor: `rgba(255,248,242,0.08)` }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{ animation: 'marqueeScroll 30s linear infinite' }}
      >
        {items.map((word, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-5 px-5 text-[11px] font-bold tracking-[3px]"
            style={{ color: `rgba(255,248,242,0.6)` }}
          >
            {word}
            <span style={{ color: C.coral, opacity: 0.7, fontSize: 8 }}>●</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Three Doors ────────────────────────────────────────────────────────────────
function ThreeDoorsSection() {
  const { ref, revealStyle } = useReveal()
  return (
    <section className="py-24 sm:py-32" style={{ background: C.cream }}>
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8">
        <div ref={ref} style={revealStyle} className="mb-14">
          <div className="text-[11px] font-bold tracking-[3px] uppercase mb-3" style={{ color: C.medgray }}>
            Three ways in
          </div>
          <h2 className="text-3xl sm:text-[2.6rem] font-bold" style={{ color: C.espresso, letterSpacing: '-0.5px' }}>
            Pick your door.
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {DOORS.map((door, i) => (
            <DoorCard key={door.num} {...door} delay={i * 130} />
          ))}
        </div>
      </div>
    </section>
  )
}

function DoorCard({
  num, accentBg, title, desc, cta, href, external, delay,
}: {
  num: string; accentBg: string; title: string; desc: string;
  cta: string; href: string; external: boolean; delay: number
}) {
  const { ref, revealStyle } = useReveal('up', delay)
  const inner = (
    <article
      className="door-card border flex flex-col h-full"
      style={{ borderColor: C.espresso, background: C.offwhite }}
    >
      <div className="h-2" style={{ background: accentBg }} />
      <div className="flex flex-col flex-1 p-7">
        <div className="text-[11px] font-bold mb-3.5" style={{ color: '#bbb' }}>{num}</div>
        <h3 className="text-xl font-bold mb-2.5" style={{ color: C.espresso }}>{title}</h3>
        <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: C.medgray }}>{desc}</p>
        <div className="text-sm font-semibold" style={{ color: C.espresso }}>{cta} →</div>
      </div>
    </article>
  )
  return (
    <div ref={ref} style={revealStyle}>
      {external
        ? <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>
        : <Link href={href} className="block h-full">{inner}</Link>
      }
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const { ref, inView } = useInView(0.2)
  const stats = [
    { target: 100, suffix: '+', label: 'artists'       },
    { target: 10,  suffix: '+', label: 'cities'        },
    { target: 20,  suffix: '+', label: 'communities'   },
    { target: 50,  suffix: '+', label: 'mapped spaces' },
  ]
  return (
    <div style={{ background: C.espresso }}>
      <div ref={ref} className="mx-auto max-w-[1180px] px-6 sm:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <StatItem key={s.label} {...s} active={inView} delay={i * 180} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatItem({ target, suffix, label, active, delay }: {
  target: number; suffix: string; label: string; active: boolean; delay: number
}) {
  const count = useCounter(target, active, suffix)
  return (
    <div
      className="py-6 text-center border-l first:border-l-0"
      style={{ borderColor: `rgba(255,248,242,0.14)` }}
    >
      <div
        className="text-3xl sm:text-4xl font-bold mb-1.5 tabular-nums"
        style={{
          color: C.cream,
          opacity: active ? 1 : 0,
          transform: active ? 'none' : 'translateY(10px)',
          transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
        }}
      >
        {count}
      </div>
      <div className="text-xs tracking-wide" style={{ color: `rgba(255,248,242,0.55)` }}>
        {label}
      </div>
    </div>
  )
}

// ── Exhibition ─────────────────────────────────────────────────────────────────
function ExhibitionSection() {
  const { ref, revealStyle } = useReveal()
  return (
    <section className="py-24 sm:py-32" style={{ background: C.cream }}>
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8">
        <div ref={ref} style={revealStyle} className="flex justify-between items-end mb-14 flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-[3px] uppercase mb-3" style={{ color: C.medgray }}>
              The exhibition
            </div>
            <h2 className="text-3xl sm:text-[2.6rem] font-bold" style={{ color: C.espresso, letterSpacing: '-0.5px' }}>
              Open call.
            </h2>
          </div>
          <Link
            href="/exhibition"
            className="text-sm font-semibold border-b pb-0.5 transition-opacity hover:opacity-70 whitespace-nowrap"
            style={{ color: C.espresso, borderColor: C.espresso }}
          >
            Submit your work →
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {EXHIBITIONS.map((ex, i) => (
            <ExCard key={ex.title} {...ex} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ExCard({ title, venue, dates, color, delay }: {
  title: string; venue: string; dates: string; color: string; delay: number
}) {
  const { ref, revealStyle } = useReveal('up', delay)
  return (
    <div ref={ref} style={revealStyle}>
      <Link
        href="/exhibition"
        className="ex-card block border"
        style={{ borderColor: C.espresso, background: C.cream }}
      >
        <div className="relative h-44" style={{ background: color }}>
          <div
            className="absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold tracking-[1.5px] uppercase border"
            style={{ background: C.cream, borderColor: C.espresso, color: C.espresso }}
          >
            Open Call
          </div>
        </div>
        <div className="p-5">
          <h4 className="text-[15px] font-bold mb-1.5" style={{ color: C.espresso }}>{title}</h4>
          <p className="text-xs" style={{ color: C.medgray }}>{venue} · {dates}</p>
        </div>
      </Link>
    </div>
  )
}

// ── Map section ────────────────────────────────────────────────────────────────
function MapSection() {
  const { ref: textRef, revealStyle: textStyle } = useReveal('left')
  const { ref: mapRef,  revealStyle: mapStyle  } = useReveal('right')
  return (
    <section className="py-24 sm:py-32" style={{ background: C.offwhite }}>
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div ref={textRef} style={textStyle}>
            <div className="text-[11px] font-bold tracking-[3px] uppercase mb-3" style={{ color: C.medgray }}>
              The map
            </div>
            <h2 className="text-3xl sm:text-[2.6rem] font-bold mb-5 leading-[1.08]" style={{ color: C.espresso, letterSpacing: '-0.5px' }}>
              Every resource,<br />mapped.
            </h2>
            <p className="text-base leading-[1.7] mb-9" style={{ color: C.medgray, maxWidth: 420 }}>
              Studios, galleries, materials shops, open calls, and workspaces — crowdsourced by the Artrium community and laid out across your entire city.
            </p>
            <div className="flex gap-10 mb-10">
              {[['50+', 'spaces'], ['10+', 'cities'], ['9', 'categories']].map(([n, l]) => (
                <div key={l}>
                  <div className="text-2xl font-bold" style={{ color: C.espresso }}>{n}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.medgray }}>{l}</div>
                </div>
              ))}
            </div>
            <Link
              href="/map"
              className="inline-flex items-center px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: C.espresso, color: C.cream }}
            >
              Explore the map →
            </Link>
          </div>
          <div ref={mapRef} style={mapStyle}>
            <MapViz />
          </div>
        </div>
      </div>
    </section>
  )
}

const MAP_PINS = [
  { top: 60,  left: 90,  color: C.gold,  label: 'Silt Gallery',    lTop: 30,  lLeft: 108 },
  { top: 140, left: 220, color: C.coral, label: 'North Studio',    lTop: 110, lLeft: 228 },
  { top: 90,  left: 300, color: C.sky  },
  { top: 220, left: 120, color: C.coral, label: 'Cambridge Arts',  lTop: 238, lLeft: 120 },
  { top: 265, left: 345, color: C.gold },
  { top: 188, left: 55,  color: C.sky  },
]

function MapViz() {
  return (
    <div
      className="relative border"
      style={{
        height: 340,
        borderColor: C.espresso,
        backgroundImage: `
          repeating-linear-gradient(0deg, #F8F8F8 0 38px, #efeee9 38px 40px),
          repeating-linear-gradient(90deg, #F8F8F8 0 38px, #efeee9 38px 40px)
        `,
      }}
    >
      {MAP_PINS.map((pin, i) => (
        <div key={i}>
          <div
            className="absolute rounded-full"
            style={{
              top: pin.top, left: pin.left,
              width: 14, height: 14,
              background: pin.color,
              border: `2.5px solid ${C.cream}`,
              boxShadow: `0 0 0 1.5px ${C.espresso}`,
              animation: `pulsePin ${2.2 + i * 0.45}s ease-in-out infinite`,
            }}
          />
          {pin.label && (
            <div
              className="absolute text-xs font-semibold px-2.5 py-1.5 border pointer-events-none"
              style={{
                top: pin.lTop!, left: pin.lLeft!,
                background: C.cream,
                borderColor: C.espresso,
                boxShadow: `0 3px 0 rgba(0,0,0,0.05)`,
                color: C.espresso,
              }}
            >
              {pin.label}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Community block ────────────────────────────────────────────────────────────
function CommunitySection() {
  const { ref, revealStyle } = useReveal()
  return (
    <section className="py-24 sm:py-32" style={{ background: C.cream }}>
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8">
        <div ref={ref} style={revealStyle}>
          <div className="border p-10 sm:p-16" style={{ background: C.sky, borderColor: C.espresso }}>
            <div className="text-[11px] font-bold tracking-[3px] uppercase mb-3.5" style={{ color: '#2a5f78' }}>
              From the community
            </div>
            <h3
              className="text-2xl sm:text-3xl font-bold mb-3 leading-[1.3]"
              style={{ color: C.espresso, maxWidth: 560 }}
            >
              What's your favorite go-to meal before getting into your creative flow?
            </h3>
            <p className="text-sm leading-relaxed mb-7" style={{ color: C.espresso, opacity: 0.7 }}>
              See how the community lives, works, and thinks — daily, in the app.
            </p>
            <a
              href={LINKS.appStore}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: C.espresso, color: C.cream }}
            >
              Join the conversation →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function FooterSection() {
  const { ref, revealStyle } = useReveal()
  return (
    <footer style={{ background: C.espresso, color: C.cream }}>
      {/* CTA */}
      <div
        className="mx-auto max-w-[1180px] px-6 sm:px-8 pt-20 pb-16 text-center border-b"
        style={{ borderColor: `rgba(255,248,242,0.12)` }}
      >
        <div ref={ref} style={revealStyle}>
          <div className="text-[11px] font-bold tracking-[3px] uppercase mb-5" style={{ color: C.gold }}>
            Join Artrium
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ letterSpacing: '-0.5px' }}>
            Make something with someone.
          </h2>
          <p
            className="text-base mb-9 mx-auto"
            style={{ color: `rgba(255,248,242,0.65)`, maxWidth: 500, lineHeight: 1.65 }}
          >
            It's free to join. Find your next collaborator, your next exhibition, or your next corner of studio space — today.
          </p>
          <a
            href={LINKS.appStore}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: C.gold, color: C.espresso }}
          >
            Create your profile
          </a>
        </div>
      </div>

      {/* Columns */}
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8 py-14">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="mb-5">
              <FooterLogo />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: `rgba(255,248,242,0.48)` }}>
              One community, three ways in — the app, the exhibition, and the map.
            </p>
          </div>

          {/* Product */}
          <FooterCol title="Product" links={[
            { label: 'The app',        href: LINKS.appStore,   external: true  },
            { label: 'The exhibition', href: '/exhibition',    external: false },
            { label: 'The map',        href: '/map',           external: false },
          ]} />

          {/* Get the app */}
          <FooterCol title="Get the app" links={[
            { label: 'App Store (iOS)',   href: LINKS.appStore, external: true },
            { label: 'Download mobile app', href: LINKS.appStore, external: true },
          ]} />

          {/* Connect */}
          <FooterCol title="Connect" links={[
            { label: 'Discord',           href: LINKS.discord,     external: true },
            { label: 'LinkedIn',          href: LINKS.linkedin,    external: true },
            { label: 'Collaborate with us', href: LINKS.collaborate, external: true },
          ]} />
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="mx-auto max-w-[1180px] px-6 sm:px-8 py-5 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
        style={{ borderColor: `rgba(255,248,242,0.1)`, color: `rgba(255,248,242,0.45)` }}
      >
        <span>© 2026 Artrium</span>
        <span>
          Questions? Reach us at{' '}
          <a
            href="mailto:artrium.app@gmail.com"
            className="underline"
            style={{ color: `rgba(255,248,242,0.75)` }}
          >
            artrium.app@gmail.com
          </a>
        </span>
        <span>
          By using this app, you acknowledge that you read the{' '}
          <Link
            href="/privacy"
            className="underline"
            style={{ color: `rgba(255,248,242,0.75)` }}
          >
            Privacy Policy
          </Link>
          .
        </span>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: {
  title: string
  links: { label: string; href: string; external: boolean }[]
}) {
  return (
    <div>
      <h5
        className="text-[11px] font-bold tracking-[1.5px] uppercase mb-5"
        style={{ color: `rgba(255,248,242,0.38)` }}
      >
        {title}
      </h5>
      <ul className="flex flex-col gap-3.5">
        {links.map(({ label, href, external }) => (
          <li key={label}>
            {external ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm transition-opacity hover:opacity-100"
                style={{ color: C.cream, opacity: 0.78 }}
              >
                {label}
              </a>
            ) : (
              <Link
                href={href}
                className="text-sm transition-opacity hover:opacity-100"
                style={{ color: C.cream, opacity: 0.78 }}
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
