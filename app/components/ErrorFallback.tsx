"use client";

import Link from "next/link";
import { useEffect } from "react";

const CREAM = "#FFF8F2";
const ESPRESSO = "#3F3A36";
// Sky, coral, gold: the three doors, as on the map's loading curtain.
const ARCH_COLORS = ["#A2DEF8", "#F69C9F", "#FBF5AF"];

/** Shared body of the error boundaries (app/global-error.tsx, app/error.tsx, app/map/error.tsx). */
export function ErrorFallback({
  error,
  retry,
  title,
  message,
  background,
}: {
  error: unknown;
  retry: () => void;
  title: string;
  message: string;
  background: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background, color: CREAM }}
    >
      <div className="flex items-end gap-2.5" aria-hidden>
        {ARCH_COLORS.map((color) => (
          <svg key={color} width="20" height="17" viewBox="0 -1 18 16" fill="none">
            <path
              d="M 1,15 L 1,8 A 8,8 0 0,1 17,8 L 17,15"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              fill={color}
            />
          </svg>
        ))}
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl" style={{ letterSpacing: "-0.5px" }}>
        {title}
      </h1>
      <p className="max-w-[420px] text-sm leading-[1.7] sm:text-base" style={{ color: "rgba(255,248,242,0.58)" }}>
        {message}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: CREAM, color: ESPRESSO }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="border px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:-translate-y-0.5"
          style={{ borderColor: "rgba(255,248,242,0.28)", color: CREAM }}
        >
          Back to Artrium Space
        </Link>
      </div>
    </main>
  );
}
