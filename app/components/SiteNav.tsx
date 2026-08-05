"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LINKS } from '../lib/links'

const ESPRESSO = '#3F3A36'
const CREAM = '#FFF8F2'

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

const NAV_LINKS = [
  { href: '/',             label: 'Home',       external: false },
  { href: LINKS.appStore, label: 'App',        external: true  },
  { href: '/exhibition',  label: 'Exhibition', external: false },
  { href: '/map',         label: 'Map',        external: false },
  { href: LINKS.discord,  label: 'Community',  external: true  },
  { href: '/updates',     label: 'Updates',    external: false },
  { href: '/team',        label: 'Team',       external: false },
]

/** Site-wide nav. On the home page it stays hidden until the user scrolls past the hero;
 * pass `alwaysSolid` on pages without a hero so it's visible immediately. */
export function SiteNav({ alwaysSolid = false }: { alwaysSolid?: boolean }) {
  const scrolled = useScrolled()
  const solid = alwaysSolid || scrolled
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background:     solid ? ESPRESSO : 'transparent',
        backdropFilter: solid ? 'blur(10px)' : 'none',
        borderBottom:   solid ? `1px solid rgba(255,248,242,0.1)` : 'none',
        transform:      alwaysSolid || scrolled ? 'translateY(0)' : 'translateY(-100%)',
        opacity:        alwaysSolid || scrolled ? 1 : 0,
        transition:     'transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease, background-color 0.4s ease',
      }}
    >
      <div className="mx-auto max-w-[1180px] px-6 sm:px-8 flex items-center justify-center h-16 sm:h-[72px]">
        <div className="flex gap-8 text-sm font-medium">
          {NAV_LINKS.map(({ href, label, external }) =>
            external ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="pb-0.5 border-b-2 border-transparent hover:border-current transition-all"
                style={{ color: CREAM, opacity: 0.75 }}
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
                style={{ color: CREAM, opacity: 0.75 }}
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
