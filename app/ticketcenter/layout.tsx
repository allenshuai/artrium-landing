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
        // Same grid-paper treatment as the homepage hero / map card.
        backgroundImage: `
          repeating-linear-gradient(0deg,  transparent 0 47px, rgba(63,58,54,0.06) 47px 48px),
          repeating-linear-gradient(90deg, transparent 0 47px, rgba(63,58,54,0.06) 47px 48px)
        `,
      }}
    >
      {children}
    </div>
  );
}
