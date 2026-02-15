"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ARCH_IMAGE_SOURCES } from "../lib/arch-images";

const GRID_COLS = 5;
const GRID_ROWS = 5;
const CENTER_COL_START = 2;
const CENTER_COL_END = 4;
const CENTER_ROW_START = 2;
const CENTER_ROW_END = 4;

const MIN_CYCLE_MS = 2500;
const MAX_CYCLE_MS = 6500;
const MAX_INITIAL_DELAY_MS = 2800;
const EMPTY_CHANCE = 0.22;
const FADE_MIN_MS = 280;
const FADE_MAX_MS = 620;

// Stable "random" per slot index (so each slot has consistent timing)
function slotSeed(index: number) {
  return (index * 9301 + 49297) % 233280;
}

function pickRandomImage(): string {
  return ARCH_IMAGE_SOURCES[Math.floor(Math.random() * ARCH_IMAGE_SOURCES.length)];
}

function isCenterCell(col: number, row: number): boolean {
  return (
    col >= CENTER_COL_START - 1 &&
    col <= CENTER_COL_END - 1 &&
    row >= CENTER_ROW_START - 1 &&
    row <= CENTER_ROW_END - 1
  );
}

export function ArchGrid() {
  const [slotStates, setSlotStates] = useState<Map<number, { src: string | null; key: number }>>(new Map());

  const slotIndices = useMemo(() => {
    const out: number[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!isCenterCell(c, r)) out.push(r * GRID_COLS + c);
      }
    }
    return out;
  }, []);

  const cycleSlot = useCallback((index: number) => {
    const empty = Math.random() < EMPTY_CHANCE;
    setSlotStates((prev) => {
      const next = new Map(prev);
      next.set(index, {
        src: empty ? null : pickRandomImage(),
        key: (next.get(index)?.key ?? 0) + 1,
      });
      return next;
    });
  }, []);

  // Initial state
  useEffect(() => {
    setSlotStates((prev) => {
      const next = new Map(prev);
      slotIndices.forEach((idx) => {
        const empty = Math.random() < EMPTY_CHANCE;
        next.set(idx, {
          src: empty ? null : pickRandomImage(),
          key: 0,
        });
      });
      return next;
    });
  }, [slotIndices]);

  // Per-slot intervals: each slot cycles on its own timing
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    slotIndices.forEach((index) => {
      const seed = slotSeed(index);
      const cycleMs = MIN_CYCLE_MS + (seed % 1000) / 1000 * (MAX_CYCLE_MS - MIN_CYCLE_MS);
      const initialDelayMs = (seed % 2000) / 2000 * MAX_INITIAL_DELAY_MS;

      const scheduleNext = () => {
        const t = setTimeout(() => {
          cycleSlot(index);
          scheduleNext();
        }, cycleMs);
        timeouts.push(t);
      };

      const initial = setTimeout(() => {
        cycleSlot(index);
        scheduleNext();
      }, initialDelayMs);
      timeouts.push(initial);
    });
    return () => timeouts.forEach(clearTimeout);
  }, [slotIndices, cycleSlot]);

  return (
    <div
      className="grid w-full flex-1 px-3 py-4 sm:gap-4 sm:px-6 sm:py-6 md:gap-5 md:px-8 md:py-8"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
        gap: "clamp(0.625rem, 2.5vw, 1.5rem)",
        maxWidth: "100%",
        height: "100%",
        minHeight: 0,
      }}
    >
      {Array.from({ length: GRID_ROWS }, (_, row) =>
        Array.from({ length: GRID_COLS }, (_, col) => {
          const index = row * GRID_COLS + col;
          if (isCenterCell(col, row)) {
            if (col === CENTER_COL_START - 1 && row === CENTER_ROW_START - 1) {
              return (
                <div
                  key="center"
                  className="flex flex-col items-center justify-center gap-3 bg-[#f5f0e8]/92 backdrop-blur-sm rounded-xl p-6 sm:p-8 text-center shadow-sm"
                  style={{
                    gridColumn: `${CENTER_COL_START} / ${CENTER_COL_END + 1}`,
                    gridRow: `${CENTER_ROW_START} / ${CENTER_ROW_END + 1}`,
                  }}
                >
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-[#3d3832] leading-tight">
                    Sustaining the arts and creative communities
                  </h2>
                  <p className="text-sm sm:text-base text-[#6b6560]">
                    see what you can do ~
                  </p>
                </div>
              );
            }
            return null;
          }
          const state = slotStates.get(index);
          const fadeMs = FADE_MIN_MS + (slotSeed(index) % 350);
          return (
            <ArchSlot
              key={index}
              src={state?.src ?? null}
              fadeKey={state?.key ?? 0}
              fadeDurationMs={fadeMs}
            />
          );
        })
      ).flat()}
    </div>
  );
}

function ArchSlot({
  src,
  fadeKey,
  fadeDurationMs,
}: {
  src: string | null;
  fadeKey: number;
  fadeDurationMs: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [fadeKey, src]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-t-[50%] bg-[#f5f0e8]"
      style={{
        aspectRatio: "1",
        borderRadius: "50% 50% 0 0",
      }}
    >
      {src ? (
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            opacity: visible ? 1 : 0,
            transitionDuration: `${fadeDurationMs}ms`,
            transitionTimingFunction: "ease-in-out",
          }}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 640px) 18vw, 12vw"
            className="object-cover object-center"
          />
        </div>
      ) : null}
    </div>
  );
}
