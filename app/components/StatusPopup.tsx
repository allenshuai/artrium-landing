"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UpdateEntry } from "../lib/updateCategories";
import { CATEGORY_META } from "../lib/updateCategories";

const ESPRESSO = "#3F3A36";
const CREAM = "#FFF8F2";
const MEDGRAY = "#666666";

const DISMISS_KEY = "artrium_dismissed_update_id";

// Full-screen app pages, not marketing sections — the popup has no "first
// section" to scroll away with here, and on /map it sits on top of Mapbox's
// own bottom-left controls. Keep it to the marketing pages only.
const HIDDEN_PATH_PREFIXES = ["/updates", "/map", "/exhibition"];

export function StatusPopup({
  update,
  currentCount = 0,
}: {
  update: UpdateEntry | null;
  currentCount?: number;
}) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!update) return;
    const dismissedId = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedId !== update.id) setVisible(true);
  }, [update]);

  if (!update || !visible) return null;
  if (HIDDEN_PATH_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  const meta = CATEGORY_META[update.category];

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, update.id);
    setVisible(false);
  };

  return (
    <div
      className="absolute left-4 z-50 hidden w-[375px] max-w-[calc(100vw-2rem)] md:block"
      style={{ top: "calc(100dvh - 1rem)", transform: "translateY(-100%)" }}
      role="dialog"
      aria-label="Latest update"
    >
      <div
        className="relative overflow-hidden border shadow-sm"
        style={{
          borderColor: ESPRESSO,
          background: CREAM,
          animation: "fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <div className="h-1.5" style={{ background: meta.color }} />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-3 flex h-6 w-6 items-center justify-center text-sm leading-none opacity-60 transition-opacity hover:opacity-100"
          style={{ color: ESPRESSO }}
        >
          ✕
        </button>

        <div className="p-4 pr-9">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px]"
              style={{ background: meta.color, color: ESPRESSO }}
            >
              {meta.label}
            </span>
            {currentCount > 1 && (
              <span
                className="inline-block px-1.5 py-0.5 text-[10px] font-bold"
                style={{ color: ESPRESSO, opacity: 0.55 }}
                title={`${currentCount} things in progress`}
              >
                +{currentCount - 1} more
              </span>
            )}
          </div>

          <h3 className="mt-2.5 text-sm font-bold leading-snug" style={{ color: ESPRESSO }}>
            {update.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: MEDGRAY }}>
            {update.description}
          </p>

          <Link
            href="/updates"
            className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: ESPRESSO, color: CREAM }}
          >
            See what&apos;s new →
          </Link>
        </div>
      </div>
    </div>
  );
}
