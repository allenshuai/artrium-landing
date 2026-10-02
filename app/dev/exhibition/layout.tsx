import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artrium Exhibition Dev",
  robots: "noindex, nofollow",
};

export default function DevExhibitionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#FFFAF6] text-[#3F3A36]">{children}</div>;
}
