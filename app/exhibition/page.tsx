"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const OPEN_CALL_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeXeG9x8zruZkR4tbHocaeHaxvlrXhz7qfU6hEYipwIIh8KQQ/viewform";

const BROWN  = "#3F3A36";
const CORAL  = "#F69C9F";
const GOLD   = "#FBF5AF";
const SKY    = "#A2DEF8";
const CREAM  = "#FFF8F2";
const FONT   = "'DM Sans', sans-serif";

const ARCH_COLORS = [SKY, CORAL, GOLD];

function Arch({ color, filled, size = 28 }: { color: string; filled: boolean; size?: number }) {
  const h = Math.round(size * 0.87);
  return (
    <svg width={size} height={h} viewBox="0 -1 18 16" fill="none">
      <path
        d="M 1,15 L 1,8 A 8,8 0 0,1 17,8 L 17,15"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={filled ? color : "none"}
        style={{ transition: "fill 0.45s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

function ArtriumLogo() {
  return (
    <svg width="160" height="28" viewBox="0 0 455.78 78.09" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M332.95,78.12c16.09,0,29.13-13.04,29.13-29.13v-29.13h-58.26v29.13c0,16.09,13.04,29.13,29.13,29.13Z" fill="#a4def8"/>
      <path d="M332.95,58.68c16.09,0,29.13-13.03,29.13-29.11V.46h-58.26v29.11c0,16.08,13.04,29.11,29.13,29.11Z" fill="#f69da0"/>
      <path d="M303.82,0v10.16c0,16.09,13.04,29.13,29.13,29.13s29.13-13.04,29.13-29.13V0h-58.26Z" fill="#faf5b1"/>
      <path d="M143.81,29.11c0-8.04-2.86-14.98-8.51-20.6C129.65,2.89,122.69.01,114.67.01h-28.6v75.2h4.49v-16.98h24.11c2.77,0,5.43-.33,7.87-.99l10.45,17.97h5.3l-11.37-19.57c3.01-1.38,5.83-3.38,8.36-5.91,5.65-5.64,8.51-12.56,8.51-20.6l.02-.02ZM139.32,29.11c0,6.76-2.44,12.61-7.24,17.42-4.79,4.79-10.67,7.23-17.44,7.23h-24.11V4.49h24.11c6.77,0,12.63,2.44,17.44,7.23,4.79,4.79,7.24,10.65,7.24,17.42v-.02Z" fill={BROWN}/>
      <path d="M145.22,4.47h22.66v70.72h4.49V4.47h22.66V.01h-49.8v4.46Z" fill={BROWN}/>
      <path d="M262.46,29.11c0-8.04-2.86-14.98-8.51-20.6C248.29,2.89,241.34.01,233.31.01h-28.6v75.2h4.49v-16.98h24.11c2.77,0,5.43-.33,7.87-.99l10.45,17.97h5.3l-11.37-19.57c3.01-1.38,5.83-3.38,8.36-5.91,5.65-5.64,8.51-12.56,8.51-20.6l.02-.02ZM257.97,29.11c0,6.76-2.44,12.61-7.24,17.42-4.79,4.79-10.67,7.23-17.44,7.23h-24.11V4.49h24.11c6.77,0,12.63,2.44,17.44,7.23,4.8,4.79,7.24,10.65,7.24,17.42v-.02Z" fill={BROWN}/>
      <path d="M285.69.01h-4.49v75.2h4.49V.01Z" fill={BROWN}/>
      <path d="M450.9.01l-32.77,45.24L385.22.01h-4.86v75.18h4.49V7.22l30.93,42.63h4.6l30.93-42.63v67.98h4.49V.01h-4.88Z" fill={BROWN}/>
      <path d="M37.42,5.72l17.68,37.73,7.21,4.74L39.97.47l-.22-.46h-4.69L12.69,47.94l7.17-4.68L37.42,5.72Z" fill={BROWN}/>
      <path d="M74.41,74.03c-1.74-3.8-3.06-6.79-3.92-8.72l-.33-.73c-1.85-4.22-3.08-7.01-5.63-10.48-.18-.29-.55-.77-1.3-1.67-6.25-7.36-15.71-11.6-25.93-11.6-11.2,0-22.52,5.73-27.52,13.95-1.3,2.15-3.65,6.92-4.93,9.6-1.54,3.18-3.01,6.44-4.38,9.69l-.48,1.14h4.95l1.94-4.15c1.12-2.44,2.24-4.85,3.41-7.27,1.56-3.21,3.39-6.57,6.33-9.42,2.29-2.22,4.82-4.06,7.48-5.47,4.07-2.15,8.64-3.29,13.22-3.32h.11c7.04,0,14.01,2.72,19.64,7.69,3.08,2.72,5.41,5.73,6.88,8.94l1.45,3.16c1.43,3.12,2.88,6.26,4.33,9.38l.22.48h4.99l-.53-1.16-.02-.04Z" fill={BROWN}/>
    </svg>
  );
}

export default function ExhibitionPage() {
  const [fillCount, setFillCount] = useState(0);
  const [visible,   setVisible]   = useState(false);

  useEffect(() => {
    const v  = setTimeout(() => setVisible(true), 80);
    const t1 = setTimeout(() => setFillCount(1), 500);
    const t2 = setTimeout(() => setFillCount(2), 950);
    const t3 = setTimeout(() => setFillCount(3), 1400);
    return () => { clearTimeout(v); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: CREAM, fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes exFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ex-in { opacity: 0; }
        .ex-in.visible { animation: exFadeUp 0.7s cubic-bezier(0.4,0,0.2,1) forwards; }
      `}</style>

      {/* Nav */}
      <nav style={{ padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <ArtriumLogo />
        </Link>
        <Link href="/" style={{ fontSize: 13, color: BROWN, opacity: 0.5, textDecoration: "none", letterSpacing: 0.3 }}>
          ← Home
        </Link>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>

        {/* Arch trio */}
        <div
          className={`ex-in${visible ? " visible" : ""}`}
          style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 40, animationDelay: "0ms" }}
        >
          {ARCH_COLORS.map((color, i) => (
            <Arch key={i} color={color} filled={fillCount > i} size={38} />
          ))}
        </div>

        {/* Label */}
        <p
          className={`ex-in${visible ? " visible" : ""}`}
          style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: BROWN, opacity: 0.4, animationDelay: "80ms" }}
        >
          Exhibition · Vol. I
        </p>

        {/* Headline */}
        <h1
          className={`ex-in${visible ? " visible" : ""}`}
          style={{ margin: "0 0 20px", fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800, color: BROWN, lineHeight: 1.08, letterSpacing: -1.5, animationDelay: "160ms" }}
        >
          The gallery is<br />
          <span style={{ color: CORAL }}>being built.</span>
        </h1>

        {/* Body */}
        <p
          className={`ex-in${visible ? " visible" : ""}`}
          style={{ margin: "0 0 40px", maxWidth: 440, fontSize: 16, color: BROWN, opacity: 0.6, lineHeight: 1.65, animationDelay: "240ms" }}
        >
          Artrium&apos;s first virtual exhibition is in development. While we prepare
          the space, we&apos;re accepting submissions from artists who want to be part of it.
        </p>

        {/* CTA */}
        <div
          className={`ex-in${visible ? " visible" : ""}`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animationDelay: "320ms" }}
        >
          <a
            href={OPEN_CALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: BROWN,
              color: CREAM,
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.4,
              padding: "14px 32px",
              textDecoration: "none",
              transition: "background 0.18s, color 0.18s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = CORAL; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = BROWN; }}
          >
            Submit your work →
          </a>
          <span style={{ fontSize: 12, color: BROWN, opacity: 0.35 }}>Open call · No fee</span>
        </div>
      </main>

      {/* Footer strip */}
      <footer style={{ padding: "20px 32px", borderTop: `1px solid ${BROWN}18`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: BROWN, opacity: 0.35 }}>
          Questions? Reach us at
        </span>
        <a href="mailto:artrium.app@gmail.com" style={{ fontSize: 12, color: BROWN, opacity: 0.5, textDecoration: "underline" }}>
          artrium.app@gmail.com
        </a>
      </footer>
    </div>
  );
}
