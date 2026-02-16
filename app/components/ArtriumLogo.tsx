"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTracePositions } from "../contexts/TracePositionsContext";
import { PhotoGridBackground } from "./PhotoGridBackground";

const VIEWBOX = { width: 924.52, height: 191.14 };

// ---------- Path for OUTLINE (thin stroke on main logo when user has dragged the yellow arch away) ----------
// Full A arch shape (outer arch + inner circle) – drawn as stroke only in the main logo SVG
const A_ARCH_PATH_FOR_OUTLINE =
  "M71.08,52.71C29.28,52.71,0,81.73,0,122.99v68.15h66.82c22.89,0,42.33-10.92,51.11-32.21v28.75h23.16v-64.69c0-42.06-28.75-70.28-70.01-70.28ZM70.81,167.71c-27.15,0-45.25-19.17-45.25-45.79s18.1-45.79,45.25-45.79,45.26,19.17,45.26,45.79-18.1,45.79-45.26,45.79Z";

// ---------- Paths for YELLOW ARCH (the draggable overlay; also used for clip so grid shows through) ----------
// Full shape for clipPath only (grid is visible through this shape)
const A_ARCH_PATH_FOR_CLIP =
  "M 71.08 52.71 C 29.28 52.71 0 81.73 0 122.99 v 68.15 h 66.82 c 22.89 0 42.33 -10.92 51.11 -32.21 v 28.75 h 23.16 v -64.69 c 0 -42.06 -28.75 -70.28 -70.01 -70.28 Z Z";
// Yellow arch – outer ring only (first subpath)
const YELLOW_ARCH_OUTER_PATH =
  "M71.08,52.71C29.28,52.71,0,81.73,0,122.99v68.15h66.82c22.89,0,42.33-10.92,51.11-32.21v28.75h23.16v-64.69c0-42.06-28.75-70.28-70.01-70.28Z";
// Yellow arch – inner circle (optional: uncomment to fill middle so there’s no hollow)
const YELLOW_ARCH_INNER_CIRCLE_PATH =
  "M70.81,167.71c-27.15,0-45.25-19.17-45.25-45.79s18.1-45.79,45.25-45.79,45.26,19.17,45.26,45.79-18.1,45.79-45.26,45.79Z";

const M_PATH =
  "M723.27,111.54c0-40.2,23.43-58.83,54.31-58.83,20.23,0,37.27,9.05,46.32,26.09,9.05-17.04,25.82-26.09,46.32-26.09,30.88,0,54.31,18.63,54.31,58.83v76.13h-25.29v-76.13c0-24.49-13.04-35.41-31.41-35.41s-31.15,11.45-31.15,35.41v76.13h-25.29v-76.13c0-23.96-13.58-35.41-31.41-35.41s-31.41,10.92-31.41,35.41v76.13h-25.29v-76.13Z";

const PATHS_REST = [
  "M159.19,110.21c0-38.87,22.89-57.5,56.7-57.5s56.44,18.63,56.44,57.77v1.33h-25.02v-1.6c0-24.22-12.78-34.07-31.41-34.07s-31.41,9.85-31.41,34.07v77.47h-25.29v-77.47Z",
  "M281.64,137.89V9.58h25.29v46.59h72.41v23.16h-72.41v58.56c0,20.76,10.91,29.81,27.42,29.81s27.69-8.78,27.69-29.81v-2.93h25.02v2.93c0,35.67-21.3,53.24-52.71,53.24s-52.71-17.57-52.71-53.24Z",
  "M400.1,110.21c0-38.87,22.89-57.5,56.7-57.5s56.44,18.63,56.44,57.77v1.33h-25.02v-1.6c0-24.22-12.78-34.07-31.41-34.07s-31.41,9.85-31.41,34.07v77.47h-25.29v-77.47Z",
  "M522.28,17.57c0-10.12,7.45-17.57,17.57-17.57s17.57,7.46,17.57,17.57-7.45,17.84-17.57,17.84-17.57-7.72-17.57-17.84ZM527.34,56.17h25.29v131.51h-25.29V56.17Z",
  "M575.26,124.85V56.17h25.29v68.68c0,28.48,15.71,42.86,39.66,42.86s39.66-14.38,39.66-42.86V56.17h25.29v68.68c0,43.66-26.09,66.29-64.96,66.29s-64.95-22.36-64.95-66.29Z",
];

const DARK_FILL = "#FFF8F2";
/** Page cream – matches page background for fog layer. */
const CREAM = "#FFF8F2";
/** When false, no collage or brush-reveal (solid logo only). */
const BRUSHING_ENABLED = false;
/** Yellow arch opacity when at rest (on the logo). */
const YELLOW_ARCH_OPACITY_AT_REST = 0.8;
/** Yellow arch opacity when user is dragging or has dragged it (more transparent so grid shows through). */
const YELLOW_ARCH_OPACITY_WHILE_MOVED = 0.8;

/** Intersection of trace rect with logo rect, in 0–1 logo-relative coords for mask. */
function traceHolesInLogo(
  positions: { left: number; top: number; width: number; height: number }[],
  logoLeft: number,
  logoTop: number,
  logoWidth: number,
  logoHeight: number
) {
  const logoRight = logoLeft + logoWidth;
  const logoBottom = logoTop + logoHeight;
  const holes: { x: number; y: number; w: number; h: number }[] = [];
  for (const t of positions) {
    const tRight = t.left + t.width;
    const tBottom = t.top + t.height;
    const iLeft = Math.max(t.left, logoLeft);
    const iTop = Math.max(t.top, logoTop);
    const iRight = Math.min(tRight, logoRight);
    const iBottom = Math.min(tBottom, logoBottom);
    if (iLeft < iRight && iTop < iBottom) {
      holes.push({
        x: (iLeft - logoLeft) / logoWidth,
        y: (iTop - logoTop) / logoHeight,
        w: (iRight - iLeft) / logoWidth,
        h: (iBottom - iTop) / logoHeight,
      });
    }
  }
  return holes;
}

export function ArtriumLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { positions: tracePositions } = useTracePositions();
  const [overlay, setOverlay] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    mounted: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, mounted: false });
  const [homePosition, setHomePosition] = useState<{ x: number; y: number } | null>(null);
  const [hasUserDragged, setHasUserDragged] = useState(false);
  const hasUserDraggedRef = useRef(false);
  hasUserDraggedRef.current = hasUserDragged;

  const [drag, setDrag] = useState<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });

  /** Positions where the arch has been (for wipe effect). Throttled by distance. */
  const [revealedPositions, setRevealedPositions] = useState<
    { x: number; y: number; width: number; height: number }[]
  >([]);
  const lastRevealedRef = useRef<{ x: number; y: number } | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState(
    () => ({ w: 1920, h: 1080 })
  );
  const [fogDrawnOnce, setFogDrawnOnce] = useState(false);
  useEffect(() => {
    const update = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const REVEAL_THROTTLE_PX = 8;
  const archPathForCanvas = useRef<Path2D | null>(null);
  if (typeof window !== "undefined" && !archPathForCanvas.current) {
    archPathForCanvas.current = new Path2D(A_ARCH_PATH_FOR_CLIP);
  }

  const runOverlayUpdate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHomePosition({ x: rect.left, y: rect.top });
    const userHasDragged = hasUserDraggedRef.current;
    setOverlay((prev) => {
      const width = rect.width;
      const height = rect.height;
      if (!userHasDragged) {
        return {
          ...prev,
          x: rect.left,
          y: rect.top,
          width,
          height,
          mounted: true,
        };
      }
      // User has dragged: keep position but clamp so overlay stays in viewport on resize
      const padding = 8;
      const maxX = typeof window !== "undefined" ? window.innerWidth - width - padding : prev.x;
      const maxY = typeof window !== "undefined" ? window.innerHeight - height - padding : prev.y;
      const x = Math.max(padding, Math.min(prev.x, maxX));
      const y = Math.max(padding, Math.min(prev.y, maxY));
      return {
        ...prev,
        x,
        y,
        width,
        height,
        mounted: true,
      };
    });
  }, []);

  const updateOverlayRect = useCallback(() => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      runOverlayUpdate();
    });
  }, [runOverlayUpdate]);

  useEffect(() => {
    runOverlayUpdate(); // initial sync immediately
    const ro = new ResizeObserver(updateOverlayRect);
    const el = containerRef.current;
    if (el) ro.observe(el);
    window.addEventListener("scroll", updateOverlayRect, true);
    window.addEventListener("resize", updateOverlayRect);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      ro.disconnect();
      window.removeEventListener("scroll", updateOverlayRect, true);
      window.removeEventListener("resize", updateOverlayRect);
    };
  }, [updateOverlayRect]);

  // Add current overlay position to "revealed" only while user is dragging (not on resize/sync)
  useEffect(() => {
    if (!BRUSHING_ENABLED || !drag.active || !overlay.mounted || overlay.width <= 0 || overlay.height <= 0)
      return;
    const last = lastRevealedRef.current;
    const dist = last
      ? Math.hypot(overlay.x - last.x, overlay.y - last.y)
      : REVEAL_THROTTLE_PX + 1;
    if (dist > REVEAL_THROTTLE_PX) {
      lastRevealedRef.current = { x: overlay.x, y: overlay.y };
      setRevealedPositions((prev) => [
        ...prev,
        { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height },
      ]);
    }
  }, [drag.active, overlay.x, overlay.y, overlay.width, overlay.height, overlay.mounted]);

  // Draw fog canvas: cream layer with arch-shaped holes at every revealed (+ current) position
  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas || !archPathForCanvas.current) return;
    const w = viewportSize.w;
    const h = viewportSize.h;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, w, h);
    if (BRUSHING_ENABLED) {
      ctx.fillStyle = "white";
      ctx.globalCompositeOperation = "destination-out";
      const path = archPathForCanvas.current;
      const showCurrentPosition = hasUserDragged || drag.active;
      const allPositions =
        !showCurrentPosition
          ? revealedPositions
          : [
              ...revealedPositions,
              { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height },
            ];
      for (const pos of allPositions) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.scale(pos.width / VIEWBOX.width, pos.height / VIEWBOX.height);
        ctx.fill(path);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    setFogDrawnOnce(true);
  }, [revealedPositions, overlay.x, overlay.y, overlay.width, overlay.height, overlay.mounted, hasUserDragged, drag.active, viewportSize.w, viewportSize.h]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (!overlay.mounted) return;
      setDrag({
        active: true,
        offsetX: e.clientX - overlay.x,
        offsetY: e.clientY - overlay.y,
      });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [overlay.x, overlay.y, overlay.mounted]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.active) return;
      setOverlay((prev) => ({
        ...prev,
        x: e.clientX - drag.offsetX,
        y: e.clientY - drag.offsetY,
      }));
    },
    [drag.active, drag.offsetX, drag.offsetY]
  );

  const handlePointerUp = useCallback(() => {
    setDrag((prev) => {
      if (prev.active) {
        hasUserDraggedRef.current = true; // so resize/scroll handlers see it before next render
        setHasUserDragged(true);
      }
      return { ...prev, active: false };
    });
  }, []);

  useEffect(() => {
    if (!drag.active) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [drag.active, handlePointerMove, handlePointerUp]);

  // Same positions as fog holes: only show collage overlay where user has brushed (so images can cover logo)
  const showCurrentPosition = hasUserDragged || drag.active;
  const brushMaskPositions =
    !showCurrentPosition
      ? revealedPositions
      : [
          ...revealedPositions,
          {
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height,
          },
        ];

  const logoTraceHoles = useMemo(
    () =>
      overlay.mounted && overlay.width > 0 && overlay.height > 0
        ? traceHolesInLogo(
            tracePositions,
            overlay.x,
            overlay.y,
            overlay.width,
            overlay.height
          )
        : [],
    [tracePositions, overlay.mounted, overlay.x, overlay.y, overlay.width, overlay.height]
  );
  const logoMaskStyle =
    logoTraceHoles.length > 0
      ? {
          maskImage: "url(#logo-trace-mask)",
          WebkitMaskImage: "url(#logo-trace-mask)" as const,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskPosition: "0 0",
          WebkitMaskPosition: "0 0",
        }
      : undefined;

  return (
    <>
      {/* Collage: only when brushing enabled; hidden until fog is drawn so it never flashes on load */}
      {BRUSHING_ENABLED && (
        <div
          className="fixed inset-0 z-10"
          style={{
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            opacity: fogDrawnOnce ? 1 : 0,
            transition: "opacity 0.15s ease-out",
          }}
        >
          <PhotoGridBackground opacity={1} />
        </div>
      )}
      {/* Fog canvas: solid cream (or holes when brushing); only when brushing so page bg shows when disabled */}
      {BRUSHING_ENABLED && (
        <canvas
          ref={fogCanvasRef}
          className="fixed left-0 top-0 z-11 pointer-events-none"
          style={{ width: "100vw", height: "100vh", display: "block" }}
        />
      )}
      {/* Mask def: holes where trace images overlap logo (objectBoundingBox 0–1) */}
      <svg width={0} height={0} aria-hidden>
        <defs>
          <mask
            id="logo-trace-mask"
            maskUnits="objectBoundingBox"
            maskContentUnits="objectBoundingBox"
            x={0}
            y={0}
            width={1}
            height={1}
          >
            <rect x={0} y={0} width={1} height={1} fill="white" />
            {logoTraceHoles.map((h, i) => (
              <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} fill="black" />
            ))}
          </mask>
        </defs>
      </svg>
      {/* Text logo: transparent where trace images overlap (mask with holes) */}
      <div
        ref={containerRef}
        className="relative z-30 w-[924.52px] max-w-[90vw] drop-shadow-sm shrink-0"
        style={logoMaskStyle}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          className="h-auto w-full min-w-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Letter A: same fill as rest of logo, no drag/outline */}
          <path
            d={A_ARCH_PATH_FOR_OUTLINE}
            fill={DARK_FILL}
            fillRule="evenodd"
          />
          {PATHS_REST.map((d, i) => (
            <path key={i} d={d} fill={DARK_FILL} />
          ))}
          <path d={M_PATH} fill={DARK_FILL} />
        </svg>
      </div>

      {/* Collage overlay: only when brushing enabled; visible in brush holes above logo */}
      {BRUSHING_ENABLED && brushMaskPositions.length > 0 && (
        <>
          <svg width={0} height={0} aria-hidden>
            <defs>
              <mask
                id="collage-reveal-mask"
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={viewportSize.w}
                height={viewportSize.h}
              >
                <rect
                  x={0}
                  y={0}
                  width={viewportSize.w}
                  height={viewportSize.h}
                  fill="black"
                />
                {brushMaskPositions.map((pos, i) => (
                  <g
                    key={i}
                    transform={`translate(${pos.x},${pos.y}) scale(${pos.width / VIEWBOX.width},${pos.height / VIEWBOX.height})`}
                  >
                    <path d={A_ARCH_PATH_FOR_CLIP} fill="white" />
                  </g>
                ))}
              </mask>
            </defs>
          </svg>
          <div
            className="pointer-events-none fixed inset-0 z-31"
            style={{
              width: "100vw",
              height: "100vh",
              maskImage: "url(#collage-reveal-mask)",
              WebkitMaskImage: "url(#collage-reveal-mask)",
              maskSize: `${viewportSize.w}px ${viewportSize.h}px`,
              WebkitMaskSize: `${viewportSize.w}px ${viewportSize.h}px`,
              maskPosition: "0 0",
              WebkitMaskPosition: "0 0",
            }}
          >
            <PhotoGridBackground opacity={1} />
          </div>
        </>
      )}

    </>
  );
}
