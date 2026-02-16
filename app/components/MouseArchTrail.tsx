"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TraceRect } from "../contexts/TracePositionsContext";
import { useTracePositions } from "../contexts/TracePositionsContext";

const ARCH_PATH =
  "M95.7731 0C42.8754 0 0 42.8827 0 95.7731V191.546H191.546V95.7731C191.546 42.8827 148.671 0 95.7731 0Z";

const ARCH_COLORS = [
  "#A2DEF8",
  "#F69C9F",
  "#FBF5AF",
  "#C5E8B7",
  "#E8D4F0",
  "#FFD9A0",
];

const ARCH_SIZE_MIN = 12;
const ARCH_SIZE_MAX = 22;
const TRACE_LIFETIME_MS = 1250;
/** Min cursor speed (px/s) to show arches; below this = no arches. */
const ARCH_MIN_SPEED_PX_S = 150;
/** Distance from image center so arches sit around the image (not in line with cursor) */
const RADIUS_PX = 88;

type Arch = {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  createdAt: number;
};

let nextId = 0;

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function archesForTrace(pos: TraceRect): Arch[] {
  const rnd = seededRandom(pos.createdAt);
  const centerX = pos.left + pos.width / 2;
  const centerY = pos.top + pos.height / 2;
  const arches: Arch[] = [];
  for (let i = 0; i < 2; i++) {
    const angle = rnd() * Math.PI * 2;
    const x = centerX + Math.cos(angle) * RADIUS_PX;
    const y = centerY + Math.sin(angle) * RADIUS_PX;
    arches.push({
      id: nextId++,
      x,
      y,
      color: ARCH_COLORS[Math.floor(rnd() * ARCH_COLORS.length)],
      size: ARCH_SIZE_MIN + rnd() * (ARCH_SIZE_MAX - ARCH_SIZE_MIN),
      rotation: (rnd() - 0.5) * 50,
      createdAt: pos.createdAt,
    });
  }
  return arches;
}

export function MouseArchTrail() {
  const { positions } = useTracePositions();
  const [arches, setArches] = useState<Arch[]>([]);
  const addedRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    positions.forEach((pos) => {
      const velocityPxPerMs = pos.spawnVelocity;
      if (typeof velocityPxPerMs !== "number" || velocityPxPerMs <= 0) return;
      const speedPxPerSec = velocityPxPerMs * 1000;
      if (speedPxPerSec < ARCH_MIN_SPEED_PX_S) return;
      if (addedRef.current.has(pos.createdAt)) return;
      addedRef.current.add(pos.createdAt);
      setArches((prev) => [...prev, ...archesForTrace(pos)]);
    });
  }, [positions]);

  const prune = useCallback(() => {
    const now = Date.now();
    setArches((prev) => {
      const next = prev.filter((a) => now - a.createdAt < TRACE_LIFETIME_MS);
      prev.forEach((a) => {
        if (now - a.createdAt >= TRACE_LIFETIME_MS)
          addedRef.current.delete(a.createdAt);
      });
      return next.length === prev.length ? prev : next;
    });
    rafRef.current = requestAnimationFrame(prune);
  }, []);

  useEffect(() => {
    if (positions.length === 0) return;
    rafRef.current = requestAnimationFrame(prune);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [positions.length, prune]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-1"
      aria-hidden
    >
      {arches.map((a) => (
        <div
          key={a.id}
          className="absolute will-change-transform"
          style={{
            left: a.x - a.size / 2,
            top: a.y - a.size / 2,
            width: a.size,
            height: a.size,
            transform: `rotate(${a.rotation}deg)`,
            animation: `arch-trail-fade ${TRACE_LIFETIME_MS}ms ease-out forwards`,
          }}
        >
          <svg
            viewBox="0 0 192 192"
            className="h-full w-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={ARCH_PATH} fill={a.color} />
          </svg>
        </div>
      ))}
    </div>
  );
}
