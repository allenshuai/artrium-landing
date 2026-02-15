"use client";

import { useCallback, useRef, useState } from "react";

// Whole expression moves as one; center of expression for rotation pivot
const EXPRESSION_CENTER = { x: 140, y: 95 };
const MAX_MOVE = 10;
const MAX_ROTATE = 6;

export function ArtriumEmoji({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expressionOffset, setExpressionOffset] = useState({ x: 0, y: 0 });
  const [expressionRotate, setExpressionRotate] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (e.clientX - centerX) / rect.width;
    const y = (e.clientY - centerY) / rect.height;
    setExpressionOffset({
      x: Math.max(-1, Math.min(1, x)) * MAX_MOVE,
      y: Math.max(-1, Math.min(1, y)) * MAX_MOVE,
    });
    setExpressionRotate(x * MAX_ROTATE);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setExpressionOffset({ x: 0, y: 0 });
    setExpressionRotate(0);
  }, []);

  const expressionTransform = `translate(${expressionOffset.x} ${expressionOffset.y}) rotate(${expressionRotate} ${EXPRESSION_CENTER.x} ${EXPRESSION_CENTER.y})`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ touchAction: "none" }}
    >
      <svg
        viewBox="0 0 192 192"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Face (stays fixed) */}
        <path
          d="M95.7731 0C42.8754 0 0 42.8827 0 95.7731V191.546H191.546V95.7731C191.546 42.8827 148.671 0 95.7731 0Z"
          fill="#FBF5AF"
        />

        {/* Whole expression moves together */}
        <g
          transform={expressionTransform}
          style={{ transition: "transform 0.12s ease-out" }}
        >
          <circle cx="121" cy="84.708" r="13" fill="white" />
          <ellipse cx="159.5" cy="84.708" rx="12.5" ry="13" fill="white" />
          <ellipse cx="124.5" cy="84.708" rx="7.5" ry="8" fill="#3F3A36" />
          <ellipse cx="156.5" cy="84.708" rx="7.5" ry="8" fill="#3F3A36" />
          <ellipse cx="141.5" cy="116.208" rx="7.5" ry="9.5" fill="#3F3A36" />
          <path
            d="M118.286 66.9391C120.596 65.8424 126.309 64.7537 130.68 69.1723"
            stroke="#3F3A36"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M162.757 66.9391C160.447 65.8424 154.734 64.7537 150.363 69.1723"
            stroke="#3F3A36"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
