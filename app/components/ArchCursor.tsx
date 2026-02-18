"use client";

import { useEffect, useRef, useState } from "react";
import { useTicketPopup } from "../contexts/TicketPopupContext";
import { useColorScheme, type ColorSchemeId } from "../contexts/ColorSchemeContext";

// Full arch shape from Vector.svg (dome/arch), viewBox 0 0 192 192
const ARCH_PATH =
  "M95.7731 0C42.8754 0 0 42.8827 0 95.7731V191.546H191.546V95.7731C191.546 42.8827 148.671 0 95.7731 0Z";

const CURSOR_COLORS = ["#A2DEF8", "#F69C9F", "#FBF5AF"] as const;
const COLOR_CYCLE_MS = 2200;

const CURSOR_SIZE = 34;
// Hotspot: bottom center of arch (tip of the dome at cursor)
const HOTSPOT_X = CURSOR_SIZE / 2;
const HOTSPOT_Y = CURSOR_SIZE;

export function ArchCursor() {
  const { isOpen: ticketPopupOpen } = useTicketPopup();
  const { schemeId, setSchemeId } = useColorScheme();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const lastMoveRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastFastRef = useRef<number | null>(null);
  const schemeIdRef = useRef<ColorSchemeId>("default");
  schemeIdRef.current = schemeId;

  useEffect(() => {
    if (ticketPopupOpen) {
      document.body.classList.remove("arch-cursor-active");
      setSchemeId("default");
      return;
    }
    document.body.classList.add("arch-cursor-active");
    return () => document.body.classList.remove("arch-cursor-active");
  }, [ticketPopupOpen]);

  useEffect(() => {
    const SPEED_THRESHOLD_PX_PER_SEC = 7500;
    const REVERT_AFTER_MS = 400;

    const pickNextScheme = () => {
      const options: ColorSchemeId[] = ["scheme1", "scheme2", "scheme3"];
      const current = schemeIdRef.current;
      // Always pick a non-default scheme; prefer one different from current.
      const pool =
        current && current !== "default"
          ? options.filter((id) => id !== current) || options
          : options;
      const idx = Math.floor(Math.random() * pool.length);
      return pool[idx]!;
    };

    const handleMove = (e: MouseEvent) => {
      const now = performance.now();
      const { clientX: x, clientY: y } = e;
      setPos({ x, y });
      if (!visible) setVisible(true);

      const last = lastMoveRef.current;
      if (last) {
        const dist = Math.hypot(x - last.x, y - last.y);
        const dt = now - last.time;
        if (dt > 0 && dist > 0) {
          const speedPxPerSec = (dist / dt) * 1000;
          if (speedPxPerSec >= SPEED_THRESHOLD_PX_PER_SEC && !ticketPopupOpen) {
            lastFastRef.current = now;
            const next = pickNextScheme();
            setSchemeId(next);
            schemeIdRef.current = next;
          }
        }
      }
      lastMoveRef.current = { x, y, time: now };
    };
    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.body.addEventListener("mouseleave", handleLeave);
    document.body.addEventListener("mouseenter", handleEnter);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.body.removeEventListener("mouseleave", handleLeave);
      document.body.removeEventListener("mouseenter", handleEnter);
    };
  }, [visible, ticketPopupOpen, setSchemeId]);

  useEffect(() => {
    const REVERT_AFTER_MS = 800;
    let rafId: number | null = null;

    const tick = () => {
      const lastFast = lastFastRef.current;
      if (lastFast !== null && schemeIdRef.current !== "default") {
        const now = performance.now();
        if (now - lastFast > REVERT_AFTER_MS) {
          setSchemeId("default");
          schemeIdRef.current = "default";
          lastFastRef.current = null;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [setSchemeId]);

  useEffect(() => {
    const id = setInterval(() => {
      setColorIndex((i) => (i + 1) % CURSOR_COLORS.length);
    }, COLOR_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  if (ticketPopupOpen || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-9999"
      style={{
        left: pos.x - HOTSPOT_X,
        top: pos.y - HOTSPOT_Y,
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        opacity: 0.75,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 192 192"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={ARCH_PATH}
          fill={CURSOR_COLORS[colorIndex]}
          style={{ transition: "fill 0.4s ease" }}
        />
      </svg>
    </div>
  );
}
