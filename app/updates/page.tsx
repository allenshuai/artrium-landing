import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUpdates, getPastUpdates } from "../lib/updates";
import { CATEGORY_META, type UpdateEntry } from "../lib/updateCategories";

const ESPRESSO = "#3F3A36";
const CREAM = "#FFF8F2";
const MEDGRAY = "#666666";
const OFFWHITE = "#F8F8F8";

export const metadata: Metadata = {
  title: "Updates | Artrium Space",
  description: "What shipped, what broke, and what we're building next on Artrium.",
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function UpdateCard({ update }: { update: UpdateEntry }) {
  const meta = CATEGORY_META[update.category];
  const isPast = update.status === "past";

  return (
    <li
      className="border overflow-hidden"
      style={{
        borderColor: ESPRESSO,
        background: OFFWHITE,
        opacity: isPast ? 0.7 : 1,
      }}
    >
      <div className="h-1.5" style={{ background: isPast ? "#c9c4bd" : meta.color }} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <span
            className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px]"
            style={{ background: isPast ? "#e6e3dd" : meta.color, color: ESPRESSO }}
          >
            {meta.label}
          </span>
          {isPast && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[1px]"
              style={{ color: MEDGRAY }}
            >
              ✓ Shipped
            </span>
          )}
          <span className="text-xs" style={{ color: MEDGRAY }}>
            {formatDate(update.date)}
          </span>
        </div>
        <h2 className="text-lg font-bold mb-1.5" style={{ color: ESPRESSO }}>
          {update.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: MEDGRAY }}>
          {update.description}
        </p>
        {update.link && (
          <a
            href={update.link}
            target={update.link.startsWith("http") ? "_blank" : undefined}
            rel={update.link.startsWith("http") ? "noopener noreferrer" : undefined}
            className="mt-3 inline-block text-sm font-semibold border-b transition-opacity hover:opacity-70"
            style={{ color: ESPRESSO, borderColor: ESPRESSO }}
          >
            Learn more →
          </a>
        )}
      </div>
    </li>
  );
}

export default function UpdatesPage() {
  const current = getCurrentUpdates();
  const past = getPastUpdates();

  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      <header className="border-b px-6 py-6" style={{ borderColor: "rgba(63,58,54,0.1)" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium underline-offset-4 hover:underline"
            style={{ color: ESPRESSO }}
          >
            ← Back to Artrium Space
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-14">
        <div className="text-[11px] font-bold tracking-[3px] uppercase mb-3" style={{ color: MEDGRAY }}>
          Changelog
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: ESPRESSO, letterSpacing: "-0.5px" }}>
          Updates
        </h1>
        <p className="text-sm leading-relaxed mb-12" style={{ color: MEDGRAY, maxWidth: 460 }}>
          What shipped, what broke, and what we&apos;re building next — posted as it happens.
        </p>

        {current.length === 0 && past.length === 0 ? (
          <p className="text-sm" style={{ color: MEDGRAY }}>
            No updates yet. Check back soon.
          </p>
        ) : (
          <>
            {current.length > 0 && (
              <section className="mb-14">
                <h2
                  className="text-xs font-bold tracking-[2px] uppercase mb-4"
                  style={{ color: ESPRESSO, opacity: 0.55 }}
                >
                  Currently working on
                </h2>
                <ol className="flex flex-col gap-6">
                  {current.map((update) => (
                    <UpdateCard key={update.id} update={update} />
                  ))}
                </ol>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2
                  className="text-xs font-bold tracking-[2px] uppercase mb-4"
                  style={{ color: ESPRESSO, opacity: 0.55 }}
                >
                  Shipped
                </h2>
                <ol className="flex flex-col gap-6">
                  {past.map((update) => (
                    <UpdateCard key={update.id} update={update} />
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
