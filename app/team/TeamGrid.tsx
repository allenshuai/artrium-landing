"use client";

import { useState } from "react";
import Image from "next/image";

const TAPE_PINK = "#F69C9F";
const TAPE_TEXT = "#FFFAF6";

// All source photos are cropped to the same 1279x1816 canvas, so one shared aspect ratio applies.
const TEAM_W = 1279;
const TEAM_H = 1816;
type Teammate = {
  file: string;
  name: string;
  /** Optional doodle overlay, same 1279x1816 canvas, revealed on hover. */
  sketch?: string;
  labelPos?: "top" | "bottom";
  /** Manual overrides for the tape tag, layered on top of the defaults. */
  labelTop?: number;
  labelLeft?: number;
  labelRotate?: number;
};

const TEAM: Teammate[] = [
  { file: "Allen.png",   name: "Allen",   sketch: "Allen_Sketch.png",    labelTop: 84 },
  { file: "Allison.png", name: "Alison",  sketch: "Alison_Sketch.png",  labelPos: "top",    labelLeft: 66, labelTop: 24, labelRotate: 20 },
  { file: "Amy.png",     name: "Amy",     sketch: "Amy_Sketch.png",                         labelTop: 76, labelLeft: 56, labelRotate: -8 },
  { file: "Brianna.png", name: "Brianna", sketch: "Brianna_Sketch.png", labelPos: "top",    labelTop: 22 },
  { file: "Elva.png",    name: "Elva",    sketch: "Elva_Sketch.png",                        labelRotate: -10 },
  { file: "Isarel.png",  name: "Israel",  sketch: "Isarel_Sketch.png", labelPos: "top",    labelLeft: 42, labelRotate: -4 },
  { file: "Jordan.png",  name: "Jordan",  sketch: "Jordan_Sketch.png" },
  { file: "Nicol.png",   name: "Nicol",   sketch: "Nicol_Sketch.png",                       labelTop: 76 },
  { file: "Sophia.png",  name: "Sophia",  sketch: "Sophia_Sketch.png" },
  { file: "Zack.png",    name: "Zack",    sketch: "Zack_Sketch.png",   labelPos: "top",    labelTop: 21 },
];

/** Deterministic pseudo-random in [-15, 15] so rotation is stable across server/client renders. */
function tapeRotation(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const r = x - Math.floor(x);
  return Math.round((-15 + r * 30) * 10) / 10;
}

export function TeamGrid() {
  // Touch devices have no hover, so tapping a face toggles the same "reveal" state
  // that desktop gets for free from group-hover. Only one face is open at a time.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      {/* Mobile-only hint: on desktop the hover affordance is self-explanatory, but touch
          screens need to be told tapping does something. */}
      <p className="mb-6 text-center text-[13px] font-medium uppercase tracking-tight text-[#3F3A36]/60 sm:hidden">
        tap a face to see their other side
      </p>

      <div className="grid grid-cols-2 items-end gap-x-3 gap-y-10 sm:grid-cols-5">
        {TEAM.map(({ file, name, sketch, labelPos = "bottom", labelTop, labelLeft, labelRotate }, i) => {
          const isActive = activeIndex === i;
          return (
            <div
              key={file}
              className="group relative"
              style={{ aspectRatio: `${TEAM_W} / ${TEAM_H}` }}
              onClick={() => sketch && setActiveIndex(isActive ? null : i)}
            >
              <Image
                src={`/Teammates/${file}`}
                alt=""
                width={TEAM_W}
                height={TEAM_H}
                className={`h-auto w-full object-contain drop-shadow-[3px_3px_0_#3F3A36] transition-all duration-500 ease-out group-hover:grayscale-0 group-hover:scale-[1.03] ${
                  sketch ? "cursor-pointer" : ""
                } ${isActive ? "grayscale-0 scale-[1.03]" : "grayscale"}`}
              />
              {sketch && (
                <Image
                  src={`/Teammates/${sketch}`}
                  alt=""
                  width={TEAM_W}
                  height={TEAM_H}
                  className={`pointer-events-none absolute inset-0 h-auto w-full object-contain drop-shadow-[3px_3px_0_#3F3A36] transition-all duration-500 ease-out group-hover:scale-[1.03] group-hover:opacity-100 ${
                    isActive ? "scale-[1.03] opacity-100" : "opacity-0"
                  }`}
                />
              )}
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
          );
        })}
      </div>
    </>
  );
}
