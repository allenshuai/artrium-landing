import type { Metadata } from "next";
import { SiteNav } from "../components/SiteNav";
import { TeamGrid } from "./TeamGrid";

const CREAM = "#FFFAF6";

export const metadata: Metadata = {
  title: "Team | Artrium Space",
  description: "The people building Artrium.",
};

// ── Background accent arches ────────────────────────────────────────────────
// Positions are expressed as a multiple of one shared --cell CSS variable (see below), so the
// grid lines and the arches are driven by the exact same unit and can never drift apart on resize.
const ARCH_FILLS = ["#A2DEF8", "#FBF5AF", "#F69C9F"];
const ARCH_OUTLINE = "#3F3A36";
const HAIRLINE_VW = 2;                    // one hairline grid square, in vw
const ARCH_CELL_HAIRLINES = 3;            // arch placement cell = 3x3 hairline squares
const ARCH_GRID_COLS = Math.floor(100 / (HAIRLINE_VW * ARCH_CELL_HAIRLINES));
const ARCH_GRID_ROWS = 20; // generous vertical coverage; layer clips via overflow-hidden
const ARCH_COUNT = 20;

/** Deterministic pseudo-random in [0, 1), stable across server/client renders. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Seeded Fisher-Yates so the chosen grid cells are stable but non-sequential. */
function shuffledIndices(total: number, seed: number): number[] {
  const arr = Array.from({ length: total }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed + i * 7.13) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const ARCH_ACCENTS = shuffledIndices(ARCH_GRID_COLS * ARCH_GRID_ROWS, 91)
  .slice(0, ARCH_COUNT)
  .map((cell, i) => {
    const col = cell % ARCH_GRID_COLS;
    const row = Math.floor(cell / ARCH_GRID_COLS);
    return {
      key: cell,
      // Position in units of --cell (the hairline grid square), centered within the arch cell.
      col: col * ARCH_CELL_HAIRLINES + ARCH_CELL_HAIRLINES / 2,
      row: row * ARCH_CELL_HAIRLINES + ARCH_CELL_HAIRLINES / 2,
      fill: ARCH_FILLS[Math.floor(rand(i * 3.1 + 1) * ARCH_FILLS.length)],
    };
  });

function ArchAccent({ fill }: { fill: string }) {
  return (
    <svg width="100%" height="100%" viewBox="-1 -1 18 16" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <path
        d="M 1,15 L 1,8 A 8,8 0 0,1 17,8 L 17,15 Z"
        stroke={ARCH_OUTLINE}
        strokeOpacity="0.4"
        strokeWidth="0.6"
        strokeLinejoin="round"
        fill={fill}
      />
    </svg>
  );
}

export default function TeamPage() {
  return (
    <div className="relative min-h-screen" style={{ background: CREAM }}>
      {/* Grid background + accent arches share one element and one --cell unit, so the arches
          are mathematically locked to the grid lines and can never drift apart on resize. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          ["--cell" as string]: `${HAIRLINE_VW}vw`,
          backgroundImage: `
            repeating-linear-gradient(0deg,  transparent 0 var(--cell), rgba(63,58,54,0.14) var(--cell) calc(var(--cell) + 1px)),
            repeating-linear-gradient(90deg, transparent 0 var(--cell), rgba(63,58,54,0.14) var(--cell) calc(var(--cell) + 1px))
          `,
        } as React.CSSProperties}
      >
        {ARCH_ACCENTS.map(({ key, col, row, fill }) => (
          <div
            key={key}
            className="absolute"
            style={{
              left: `calc(var(--cell) * ${col})`,
              top: `calc(var(--cell) * ${row})`,
              width: "var(--cell)",
              height: "var(--cell)",
              transform: "translate(-50%, -50%)",
            }}
          >
            <ArchAccent fill={fill} />
          </div>
        ))}
      </div>

      <SiteNav alwaysSolid />

      {/* Teammates */}
      <main className="relative mx-auto max-w-[1180px] px-6 pb-24 pt-24 sm:px-8 sm:pt-32">
        <TeamGrid />
      </main>
    </div>
  );
}
