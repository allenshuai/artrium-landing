"use client";

import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import { ARCH_IMAGE_SOURCES } from "../lib/arch-images";

/** Deterministic pseudo-random in [0, 1) for stable collage layout. */
function seeded(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Round to 2 decimals so server and client produce identical style values (avoids hydration mismatch). */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Viewport size at first load only – we don't resize the collage on window resize; user can refresh to get a new layout. */
function useInitialViewportSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (size === null)
      setSize({ width: window.innerWidth, height: window.innerHeight });
  }, [size]);
  return size ?? { width: 1920, height: 1080 };
}

const COLLAGE_COUNT = 42;
const MIN_SIZE = 110;
const MAX_SIZE = 200;
const MAX_ROTATION_DEG = 3;
/** Spread factor: 1 = within viewport, >1 = more spread. */
const SPREAD = 1.02;

export function PhotoGridBackground({
  className = "",
  opacity = 1,
  style = {},
}: {
  className?: string;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  const { width, height } = useInitialViewportSize();

  const items = useMemo(() => {
    const out: {
      src: string;
      key: string;
      left: number;
      top: number;
      width: number;
      height: number;
      rotation: number;
      zIndex: number;
    }[] = [];
    for (let i = 0; i < COLLAGE_COUNT; i++) {
      const imgW = r2(MIN_SIZE + seeded(i, 1) * (MAX_SIZE - MIN_SIZE));
      const imgH = r2(MIN_SIZE + seeded(i, 2) * (MAX_SIZE - MIN_SIZE));
      const left = r2((seeded(i, 3) * SPREAD - (SPREAD - 1) / 2) * width);
      const top = r2((seeded(i, 4) * SPREAD - (SPREAD - 1) / 2) * height);
      const rotation = r2((seeded(i, 5) - 0.5) * 2 * MAX_ROTATION_DEG);
      const zIndex = Math.floor(seeded(i, 6) * COLLAGE_COUNT);
      out.push({
        src: ARCH_IMAGE_SOURCES[i % ARCH_IMAGE_SOURCES.length],
        key: `collage-${i}`,
        left,
        top,
        width: imgW,
        height: imgH,
        rotation,
        zIndex,
      });
    }
    return out;
  }, [width, height]);

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        minWidth: "100vw",
        minHeight: "100vh",
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    >
      {items.map(({ src, key, left, top, width: w, height: h, rotation, zIndex }) => (
        <div
          key={key}
          className="absolute overflow-hidden rounded-sm shadow-md"
          style={{
            left,
            top,
            width: w,
            height: h,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center center",
            zIndex,
          }}
        >
          <Image
            src={src}
            alt=""
            width={Math.round(w)}
            height={Math.round(h)}
            className="object-cover w-full h-full"
          />
        </div>
      ))}
    </div>
  );
}
