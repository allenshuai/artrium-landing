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

/** New text logo (newLogo.svg) – viewBox 1174×202, colored arches + cream text. */
const NEW_LOGO_VIEWBOX = { width: 1174, height: 202 };
const NEW_LOGO_PATHS: { d: string; fill: string }[] = [
  { d: "M857.887 202.027C899.248 202.027 932.773 170.995 932.773 132.71L932.773 63.3931L783 63.3931L783 132.71C783 170.995 816.531 202.027 857.887 202.027Z", fill: "#A2DEF8" },
  { d: "M857.887 155.785C899.248 155.785 932.773 124.768 932.773 86.5131L932.773 17.241L783 17.241L783 86.5131C783 124.768 816.525 155.785 857.887 155.785Z", fill: "#F69C9F" },
  { d: "M858 110C899.424 110 933 85.3736 933 55L933 1.52588e-05L783 2.14537e-06L783 55C783 85.3736 816.576 110 858 110Z", fill: "#FBF5AF" },
  { d: "M371.589 75.6676C371.589 54.7996 364.178 36.7593 349.468 22.1121C334.815 7.46497 316.768 0 295.891 0H221.664V195.051H234.62V151.335H295.891C302.907 151.335 309.583 150.543 315.806 148.903L342.623 195.051H357.898L328.422 144.266C335.947 140.703 343.019 135.614 349.412 129.223C364.065 114.576 371.533 96.5356 371.533 75.6676H371.589ZM358.634 75.6676C358.634 92.8596 352.467 107.79 340.246 120.005C328.026 132.22 313.09 138.385 295.891 138.385H234.62V12.9506H295.891C313.09 12.9506 328.026 19.1148 340.246 31.3302C352.467 43.5456 358.634 58.4756 358.634 75.6676Z", fill: "#FFF8F2" },
  { d: "M373.795 12.9506H432.124V195.051H445.024V12.9506H503.353V0H373.795V12.9506Z", fill: "#FFF8F2" },
  { d: "M676.757 75.6676C676.757 54.7996 669.346 36.7593 654.636 22.1121C639.983 7.46497 621.936 0 601.059 0H526.832V195.051H539.788V151.335H601.059C608.075 151.335 614.75 150.543 620.974 148.903L647.791 195.051H663.066L633.59 144.266C641.115 140.703 648.187 135.614 654.58 129.223C669.233 114.576 676.701 96.5356 676.701 75.6676H676.757ZM663.802 75.6676C663.802 92.8596 657.635 107.79 645.414 120.005C633.194 132.22 618.258 138.385 601.059 138.385H539.788V12.9506H601.059C618.258 12.9506 633.194 19.1148 645.414 31.3302C657.635 43.5456 663.802 58.4756 663.802 75.6676Z", fill: "#FFF8F2" },
  { d: "M736.501 0H723.545V195.051H736.501V0Z", fill: "#FFF8F2" },
  { d: "M1160.42 0L1076.46 115.99L992.223 0H978.588V195.051H991.544V21.4335L1070.07 129.789H1082.57L1161.1 21.4335V195.051H1174V0H1160.42Z", fill: "#FFF8F2" },
  { d: "M97.2531 17.0789L141.835 112.37L142.174 113.049L162.994 126.791L103.703 0H90.7469L31.9648 126.113L52.6715 112.597L97.2531 17.0789Z", fill: "#FFF8F2" },
  { d: "M183.022 168.584L182.173 166.661C177.591 156.142 174.253 148.564 167.633 139.572C167.464 139.346 165.88 137.197 164.239 135.274C148.058 116.159 123.561 105.188 96.9705 105.188C67.8906 105.188 38.5845 120.061 25.5721 141.438C22.2341 146.98 16.1806 159.309 12.8426 166.208C8.82573 174.465 5.03516 182.891 1.58405 191.148L-0.0566406 195.05H14.1438L19.2922 183.966C22.1776 177.689 25.0629 171.468 28.0614 165.247C32.0217 157.047 36.7175 148.451 44.1855 141.212C50.0128 135.557 56.4624 130.863 63.2514 127.3C73.6613 121.815 85.3159 118.874 96.9705 118.817C115.188 118.648 132.896 125.717 147.323 138.384C155.187 145.34 161.071 152.975 164.861 161.175L168.482 169.093C172.216 177.236 175.95 185.38 179.741 193.467L180.476 195.107H194.846L193.036 191.092C188.566 181.308 185.172 173.617 182.965 168.64L183.022 168.584Z", fill: "#FFF8F2" },
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
          {NEW_LOGO_PATHS.map((p, i) => (
            <path key={i} d={p.d} fill={p.fill} />
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
