"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TraceRect } from "../contexts/TracePositionsContext";
import { useTracePositions } from "../contexts/TracePositionsContext";
import { useTicketPopup } from "../contexts/TicketPopupContext";
import { PhotoGridBackground } from "./PhotoGridBackground";

/** Only show logo holes while trace is still at full opacity (before fade). Removes black flash when trace fades. */
const TRACE_HOLE_MAX_AGE_MS = 380;
/** Logo opacity where trace images overlap (0 = trace takes over, 1 = logo solid). Keeps text visible as overlay. */
const LOGO_TRACE_OVERLAY_OPACITY = 0.52;

const VIEWBOX = { width: 924.52, height: 191.14 };

/** New text logo (newLogo.svg) – viewBox 197×33, same container width for consistent size. */
const NEW_LOGO_VIEWBOX = { width: 197, height: 33 };
const NEW_LOGO_PATHS = [
  "M37.1816 0H49.2351C52.6448 0 55.5483 1.18603 57.9456 3.56757C60.3429 5.94911 61.5368 8.83353 61.5368 12.2208C61.5368 15.6081 60.3429 18.4925 57.9456 20.8741C56.7613 22.0506 55.4719 22.9235 54.0583 23.5118L58.8816 31.776H57.4012L52.8263 23.9577C51.7088 24.2803 50.5149 24.4416 49.2351 24.4416H38.4137V31.776H37.1816V0ZM38.4042 1.22398V23.2177H49.2255C52.2723 23.2177 54.8797 22.1455 57.0478 19.9917C59.2159 17.8378 60.2952 15.2476 60.2952 12.2208C60.2952 9.19408 59.2159 6.6038 57.0478 4.44997C54.8797 2.29615 52.2723 1.22398 49.2255 1.22398H38.4042Z",
  "M83.7725 0V1.22398H73.9349V31.776H72.7028V1.22398H62.8652V0H83.782H83.7725Z",
  "M88.7012 0H100.755C104.164 0 107.068 1.18603 109.465 3.56757C111.862 5.94911 113.056 8.83353 113.056 12.2208C113.056 15.6081 111.862 18.4925 109.465 20.8741C108.281 22.0506 106.991 22.9235 105.578 23.5118L110.401 31.776H108.921L104.346 23.9577C103.228 24.2803 102.034 24.4416 100.755 24.4416H89.9333V31.776H88.7012V0ZM89.9237 1.22398V23.2177H100.745C103.792 23.2177 106.399 22.1455 108.567 19.9917C110.735 17.8378 111.815 15.2476 111.815 12.2208C111.815 9.19408 110.735 6.6038 108.567 4.44997C106.399 2.29615 103.792 1.22398 100.745 1.22398H89.9237Z",
  "M123.142 0V31.776H121.91V0H123.142Z",
  "M155.127 20.7792V0H156.359V20.7792C156.359 24.1665 155.165 27.0509 152.768 29.4324C150.371 31.814 147.467 33 144.058 33C140.648 33 137.744 31.814 135.347 29.4324C132.95 27.0509 131.756 24.1665 131.756 20.7792V0H132.988V20.7792C132.988 23.8059 134.067 26.3962 136.235 28.55C138.403 30.7039 141.011 31.776 144.058 31.776C147.104 31.776 149.712 30.7039 151.88 28.55C154.048 26.3962 155.127 23.8059 155.127 20.7792Z",
  "M166.197 1.66044V31.776H164.965V0H166.541L181.011 19.8019L195.423 0H196.999V31.776H195.767V1.66044L181.794 20.8266H180.17L166.197 1.66044Z",
  "M7.80303 18.094C10.4391 12.4865 13.0657 6.87895 15.7017 1.27142C18.3569 6.90742 21.0121 12.5434 23.6673 18.1699C24.3359 18.6064 24.9949 19.0334 25.6635 19.4698L16.4849 0H14.909L5.81641 19.3749C6.47543 18.948 7.13445 18.521 7.80303 18.094Z",
  "M27.2016 23.227C27.2016 23.227 26.9342 22.857 26.6572 22.5249C23.9256 19.3274 19.8664 17.6479 15.6639 17.6479C10.6783 17.6479 5.98872 20.2762 4.02121 23.5022C3.39084 24.5364 2.17785 27.0318 1.90087 27.6106C1.06993 29.3279 0.430012 30.7701 0.00976562 31.7759H1.38512C2.1301 30.2009 2.84643 28.6068 3.61051 27.0413C4.36505 25.4757 5.16733 24.081 6.43762 22.8665C7.43093 21.9176 8.54841 21.0922 9.76139 20.447C11.5856 19.4887 13.6105 18.9858 15.6735 18.9763C18.9495 18.9668 22.044 20.2477 24.4891 22.3826C25.7594 23.4927 26.8578 24.821 27.5646 26.3581C28.3955 28.1609 29.2264 29.9731 30.0765 31.7664H31.4518C30.6973 30.1249 30.1147 28.8251 29.7517 27.9901C28.8826 26.026 28.3573 24.7641 27.2112 23.2175L27.2016 23.227Z",
];

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

/** 3D tilt: max rotation (deg) and sensitivity (px from center per degree). Logo "leans" toward cursor. */
const TILT_MAX_DEG = 2;
const TILT_SENSITIVITY_PX = 280;
/** Yellow arch opacity when at rest (on the logo). */
const YELLOW_ARCH_OPACITY_AT_REST = 0.8;
/** Yellow arch opacity when user is dragging or has dragged it (more transparent so grid shows through). */
const YELLOW_ARCH_OPACITY_WHILE_MOVED = 0.8;

/** Intersection of trace rect with logo rect, in 0–1 logo-relative coords for mask. */
function traceHolesInLogo(
  positions: TraceRect[],
  logoLeft: number,
  logoTop: number,
  logoWidth: number,
  logoHeight: number,
  now: number
) {
  const logoRight = logoLeft + logoWidth;
  const logoBottom = logoTop + logoHeight;
  const holes: { x: number; y: number; w: number; h: number }[] = [];
  for (const t of positions) {
    if (now - t.createdAt >= TRACE_HOLE_MAX_AGE_MS) continue;
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
  const logoTraceMaskId = "logo-trace-mask-artrium";
  const { positions: tracePositions } = useTracePositions();
  const { isOpen: ticketPopupOpen } = useTicketPopup();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const tiltRafRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
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
  const [tick, setTick] = useState(0);
  const tickRafRef = useRef<number | null>(null);
  useEffect(() => {
    const update = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    if (tracePositions.length === 0) return;
    const raf = () => {
      setTick(Date.now());
      tickRafRef.current = requestAnimationFrame(raf);
    };
    tickRafRef.current = requestAnimationFrame(raf);
    return () => {
      if (tickRafRef.current !== null) cancelAnimationFrame(tickRafRef.current);
    };
  }, [tracePositions.length]);

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

  // 3D tilt: logo leans toward cursor (gravitational feel). Disabled when ticket popup is open.
  useEffect(() => {
    if (ticketPopupOpen) {
      setTilt({ x: 0, y: 0 });
      return;
    }
    const updateTilt = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const { x: mx, y: my } = mouseRef.current;
      const deltaX = mx - centerX;
      const deltaY = my - centerY;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const tiltY = clamp((deltaX / TILT_SENSITIVITY_PX) * TILT_MAX_DEG, -TILT_MAX_DEG, TILT_MAX_DEG);
      const tiltX = clamp((-deltaY / TILT_SENSITIVITY_PX) * TILT_MAX_DEG, -TILT_MAX_DEG, TILT_MAX_DEG);
      setTilt({ x: tiltX, y: tiltY });
    };
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (tiltRafRef.current === null) {
        tiltRafRef.current = requestAnimationFrame(() => {
          tiltRafRef.current = null;
          updateTilt();
        });
      }
    };
    const onLeave = () => setTilt({ x: 0, y: 0 });
    window.addEventListener("mousemove", onMove, { passive: true });
    document.body.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.body.removeEventListener("mouseleave", onLeave);
      if (tiltRafRef.current !== null) cancelAnimationFrame(tiltRafRef.current);
    };
  }, [ticketPopupOpen]);

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
            overlay.height,
            tick || Date.now()
          )
        : [],
    [tracePositions, overlay.mounted, overlay.x, overlay.y, overlay.width, overlay.height, tick]
  );
  const logoMaskStyle =
    logoTraceHoles.length > 0
      ? {
          maskImage: `url(#${logoTraceMaskId})`,
          WebkitMaskImage: `url(#${logoTraceMaskId})` as const,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskPosition: "0 0",
          WebkitMaskPosition: "0 0",
          maskRepeat: "no-repeat" as const,
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
            id={logoTraceMaskId}
            maskUnits="objectBoundingBox"
            maskContentUnits="objectBoundingBox"
            x={0}
            y={0}
            width={1}
            height={1}
          >
            <rect x={0} y={0} width={1} height={1} fill="white" />
            {/* Black at (1 - opacity) so mask value = logo opacity in trace areas (logo stays translucent) */}
            {logoTraceHoles.map((h, i) => (
              <rect
                key={i}
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                fill="black"
                fillOpacity={1 - LOGO_TRACE_OVERLAY_OPACITY}
              />
            ))}
          </mask>
        </defs>
      </svg>
      {/* Text logo: transparent where trace images overlap (mask with holes); 3D tilt toward cursor */}
      <div
        className="relative z-30 shrink-0"
        style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}
      >
        <div
          ref={containerRef}
          className="w-[924.52px] max-w-[90vw] drop-shadow-sm"
          style={{
            ...logoMaskStyle,
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
        <svg
          viewBox={`0 0 ${NEW_LOGO_VIEWBOX.width} ${NEW_LOGO_VIEWBOX.height}`}
          className="h-auto w-full min-w-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {NEW_LOGO_PATHS.map((d, i) => (
            <path key={i} d={d} fill={DARK_FILL} />
          ))}
        </svg>
        </div>
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
