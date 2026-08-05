import type { Metadata } from "next";
import Image from "next/image";
import { SiteNav } from "../components/SiteNav";

const CREAM = "#FFFAF6";
const TAPE_PINK = "#F69C9F";
const TAPE_TEXT = "#FFFAF6";

export const metadata: Metadata = {
  title: "Team | Artrium Space",
  description: "The people building Artrium.",
};

// All source photos are cropped to the same 1279x1816 canvas, so one shared aspect ratio applies.
const TEAM_W = 1279;
const TEAM_H = 1816;
type Teammate = {
  file: string;
  name: string;
  labelPos?: "top" | "bottom";
  /** Manual overrides for the tape tag, layered on top of the defaults. */
  labelTop?: number;
  labelLeft?: number;
  labelRotate?: number;
};

const TEAM: Teammate[] = [
  { file: "Allison.png", name: "Allison", labelPos: "top",    labelLeft: 66, labelTop: 24, labelRotate: 20 },
  { file: "Allen.png",   name: "Allen",                       labelTop: 84 },
  { file: "Amy.png",     name: "Amy",                         labelTop: 76, labelLeft: 56, labelRotate: -8 },
  { file: "Brianna.png", name: "Brianna", labelPos: "top",    labelTop: 22 },
  { file: "Elva.png",    name: "Elva",                        labelRotate: -10 },
  { file: "Isarel.png",  name: "Israel",  labelPos: "top",    labelLeft: 42, labelRotate: -4 },
  { file: "Jordan.png",  name: "Jordan" },
  { file: "Nicol.png",   name: "Nicol",                       labelTop: 76 },
  { file: "Sophia.png",  name: "Sophia" },
  { file: "Zack.png",    name: "Zack",    labelPos: "top",    labelTop: 21 },
];

/** Deterministic pseudo-random in [-15, 15] so rotation is stable across server/client renders. */
function tapeRotation(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const r = x - Math.floor(x);
  return Math.round((-15 + r * 30) * 10) / 10;
}

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
        <div className="grid grid-cols-5 items-end gap-x-3 gap-y-10">
          {TEAM.map(({ file, name, labelPos = "bottom", labelTop, labelLeft, labelRotate }, i) => (
            <div key={file} className="group relative" style={{ aspectRatio: `${TEAM_W} / ${TEAM_H}` }}>
              <Image
                src={`/Teammates/${file}`}
                alt=""
                width={TEAM_W}
                height={TEAM_H}
                className="h-auto w-full object-contain grayscale drop-shadow-[3px_3px_0_#3F3A36] transition-all duration-500 ease-out group-hover:grayscale-0 group-hover:scale-[1.03]"
              />
              <span
                className="absolute z-10 whitespace-nowrap px-[14px] text-[12.5px] sm:text-[13.5px] font-bold uppercase tracking-tight select-none leading-[1.6]"
                style={{
                  background: TAPE_PINK,
                  color: TAPE_TEXT,
                  left: `${labelLeft ?? 50}%`,
                  top: `${labelTop ?? (labelPos === "top" ? 18 : 70)}%`,
                  transform: `translate(-50%, -50%) rotate(${labelRotate ?? tapeRotation(i + 1)}deg)`,
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
