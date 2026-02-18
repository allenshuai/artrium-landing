"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const UNDERLINE_COLOR = "#F69C9F";
const UNDERLINE_OPACITY = 1;
const UNDERLINE_HEIGHT = 1.5;
const UNDERLINE_WIDTH = 52;
const DURATION_PER_LINE_MS = 2600;

type WordRect = { left: number; top: number; width: number; height: number };
type Line = { y: number; height: number; xStart: number; xEnd: number };

/** Start a new line when word top is this many px below current line top. */
const LINE_TOP_THRESHOLD_PX = 3;

function getLines(wordRects: WordRect[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;

  for (const r of wordRects) {
    const isNewLine =
      current === null || r.top > current.y + LINE_TOP_THRESHOLD_PX;
    if (isNewLine) {
      current = { y: r.top, height: r.height, xStart: r.left, xEnd: r.left + r.width };
      lines.push(current);
    } else if (current) {
      current.xEnd = r.left + r.width;
      current.height = Math.max(current.height, r.height);
    }
  }
  return lines;
}

/** Only the word under the underline (same line, contains underline center X) is highlighted. */
function wordIndexUnderUnderlineCenter(
  wordRects: { left: number; width: number; top: number; height: number }[],
  underlineCenterX: number,
  underlineTop: number
): number | null {
  for (let i = 0; i < wordRects.length; i++) {
    const w = wordRects[i];
    const wordBottom = w.top + w.height;
    const containsX = underlineCenterX >= w.left && underlineCenterX <= w.left + w.width;
    const sameLine = wordBottom >= underlineTop - 4 && w.top <= underlineTop + 6;
    if (sameLine && containsX) return i;
  }
  return null;
}

export function HighlightParagraph({
  text,
  className = "",
  style = {},
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const underlineRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const linesRef = useRef<Line[]>([]);
  const wordRectsRef = useRef<WordRect[]>([]);
  const animRef = useRef({ lineIndex: 0, startTime: 0, running: false });
  const measureRef = useRef<() => void>(() => {});
  const frameCountRef = useRef(0);

  const words = text.split(/\s+/).filter(Boolean);

  const updateHighlighted = useCallback(() => {
    const underline = underlineRef.current;
    if (!underline) return;
    const container = containerRef.current;
    if (!container) return;
    const u = underline.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    const underlineCenterX = (u.left - c.left) + UNDERLINE_WIDTH / 2;
    const underlineTop = u.top - c.top;
    const wordSpans = container.querySelectorAll<HTMLSpanElement>("[data-word-index]");
    const wordRects = Array.from(wordSpans).map((span) => {
      const r = span.getBoundingClientRect();
      return {
        left: r.left - c.left,
        width: r.width,
        top: r.top - c.top,
        height: r.height,
      };
    });
    const index = wordIndexUnderUnderlineCenter(wordRects, underlineCenterX, underlineTop);
    const next = index !== null ? new Set([index]) : new Set<number>();
    setHighlighted((prev) => {
      if (prev.size !== next.size || [...prev].some((i) => !next.has(i))) return next;
      return prev;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || words.length === 0) return;

    const measure = () => {
      const wordSpans = container.querySelectorAll<HTMLSpanElement>("[data-word-index]");
      if (wordSpans.length === 0) return;
      const containerRect = container.getBoundingClientRect();
      const rects: WordRect[] = Array.from(wordSpans).map((s) => {
        const r = s.getBoundingClientRect();
        return {
          left: r.left - containerRect.left,
          top: r.top - containerRect.top,
          width: r.width,
          height: r.height,
        };
      });
      wordRectsRef.current = rects;
      const newLines = getLines(rects);
      const hadLines = linesRef.current.length;
      linesRef.current = newLines;
      if (newLines.length > 0 && hadLines === 0) {
        animRef.current = { lineIndex: 0, startTime: performance.now(), running: true };
      }
    };

    measureRef.current = measure;
    const schedule = () => requestAnimationFrame(() => requestAnimationFrame(measure));
    schedule();
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 200);
    const t3 = setTimeout(measure, 500);
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
    };
  }, [words.length]);

  useEffect(() => {
    const container = containerRef.current;
    const underline = underlineRef.current;
    if (!container || !underline) return;

    let rafId: number;

    const tick = () => {
      frameCountRef.current += 1;
      if (frameCountRef.current % 90 === 0) {
        measureRef.current();
      }
      const lines = linesRef.current;
      const now = performance.now();
      const anim = animRef.current;

      if (lines.length > 0) {
        if (!anim.running) {
          animRef.current = { lineIndex: 0, startTime: now, running: true };
        }
        const lineIndex = anim.lineIndex % lines.length;
        const line = lines[lineIndex];
        if (line) {
          const elapsed = now - anim.startTime;
          const t = Math.min(1, elapsed / DURATION_PER_LINE_MS);

          const xStart = line.xStart;
          const xEnd = Math.max(line.xEnd - UNDERLINE_WIDTH, line.xStart);
          const left = xStart + t * (xEnd - xStart);
          const top = line.y + line.height;

          underline.style.left = `${left}px`;
          underline.style.top = `${top}px`;
          underline.style.width = `${UNDERLINE_WIDTH}px`;
          underline.style.height = `${UNDERLINE_HEIGHT}px`;

          if (t >= 1) {
            animRef.current = {
              lineIndex: lineIndex + 1,
              startTime: now,
              running: true,
            };
          }
        }
      }

      updateHighlighted();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [words.length, updateHighlighted]);

  return (
    <div
      ref={containerRef}
      role="paragraph"
      className={`relative max-w-xl pb-6 text-center text-base leading-relaxed ${className}`}
      style={style}
    >
      <div
        ref={underlineRef}
        className="pointer-events-none absolute transition-none"
        style={{
          width: UNDERLINE_WIDTH,
          height: UNDERLINE_HEIGHT,
          backgroundColor: UNDERLINE_COLOR,
          opacity: UNDERLINE_OPACITY,
          zIndex: 0,
          willChange: "left, top",
        }}
        aria-hidden
      />
      <span className="relative z-10">
        {words.map((word, i) => (
          <span
            key={i}
            data-word-index={i}
            className="transition-opacity duration-150"
            style={{ opacity: highlighted.has(i) ? 1 : 0.5 }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </div>
  );
}
