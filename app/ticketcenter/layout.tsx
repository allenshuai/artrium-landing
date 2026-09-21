import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artrium Ticket Center",
  robots: "noindex, nofollow",
};

export default function TicketCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[#FFFAF6] text-[#3F3A36]"
      style={{
        // Same grid-paper treatment as the homepage hero / map card, but drawn
        // as a fixed 48px tile. A single repeating gradient spanning the whole
        // page re-rasterizes whenever the page height changes and its lines
        // drift/stretch (visible when filters change the row count). A tiled
        // background is independent of the element size, so it stays put.
        backgroundImage: `
          linear-gradient(to right,  rgba(63,58,54,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(63,58,54,0.06) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        backgroundPosition: "-1px -1px",
      }}
    >
      {children}
    </div>
  );
}
