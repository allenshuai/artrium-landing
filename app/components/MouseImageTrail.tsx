"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTracePositions } from "../contexts/TracePositionsContext";
import { ARCH_IMAGE_SOURCES } from "../lib/arch-images";

/** Min distance (px) cursor must move before spawning a new trace. Slow movement = no spawn. */
const MIN_DISTANCE_TO_SPAWN_PX = 48;
/** Size range for each trace image (px). */
const TRACE_SIZE_MIN = 128;
const TRACE_SIZE_MAX = 220;
/** How long (ms) until a trace is fully faded and removed. */
const FADE_DURATION_MS = 950;
/** Max number of traces on screen (drop oldest if over). */
const MAX_TRACES = 28;

type Trace = {
  id: number;
  x: number;
  y: number;
  src: string;
  size: number;
  rotation: number;
  createdAt: number;
};

let nextId = 0;
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function MouseImageTrail() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const { setPositions } = useTracePositions();
  const lastSpawnRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setPositions(
      traces.map((t) => ({
        left: t.x - t.size / 2,
        top: t.y - t.size / 2,
        width: t.size,
        height: t.size,
      }))
    );
  }, [traces, setPositions]);

  const pruneAndFade = useCallback(() => {
    const now = Date.now();
    setTraces((prev) => {
      const next = prev.filter((t) => now - t.createdAt < FADE_DURATION_MS);
      return next.length === prev.length ? prev : next;
    });
    rafRef.current = requestAnimationFrame(pruneAndFade);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(pruneAndFade);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [pruneAndFade]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const last = lastSpawnRef.current;
      const distance = last
        ? Math.hypot(clientX - last.x, clientY - last.y)
        : MIN_DISTANCE_TO_SPAWN_PX + 1;

      if (distance < MIN_DISTANCE_TO_SPAWN_PX) return;

      lastSpawnRef.current = { x: clientX, y: clientY };

      const size =
        TRACE_SIZE_MIN +
        Math.random() * (TRACE_SIZE_MAX - TRACE_SIZE_MIN);
      const rotation = (Math.random() - 0.5) * 24;

      setTraces((prev) => {
        const next = [
          ...prev,
          {
            id: nextId++,
            x: clientX,
            y: clientY,
            src: pickRandom(ARCH_IMAGE_SOURCES),
            size,
            rotation,
            createdAt: Date.now(),
          },
        ];
        if (next.length > MAX_TRACES) return next.slice(-MAX_TRACES);
        return next;
      });
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
    >
      {traces.map((t) => (
          <div
            key={t.id}
            className="absolute overflow-hidden rounded-md shadow-lg will-change-transform"
            style={{
              left: t.x - t.size / 2,
              top: t.y - t.size / 2,
              width: t.size,
              height: t.size,
              transform: `rotate(${t.rotation}deg)`,
              animation: `mouse-trail-fade ${FADE_DURATION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards`,
            }}
          >
            <Image
              src={t.src}
              alt=""
              width={Math.round(t.size)}
              height={Math.round(t.size)}
              className="object-cover w-full h-full"
            />
          </div>
      ))}
    </div>
  );
}
