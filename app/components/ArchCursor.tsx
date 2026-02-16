"use client";

import { useEffect, useState } from "react";
import { useTicketPopup } from "../contexts/TicketPopupContext";

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
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    if (ticketPopupOpen) {
      document.body.classList.remove("arch-cursor-active");
      return;
    }
    document.body.classList.add("arch-cursor-active");
    return () => document.body.classList.remove("arch-cursor-active");
  }, [ticketPopupOpen]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!visible) setVisible(true);
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
  }, [visible]);

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
