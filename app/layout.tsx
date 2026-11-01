import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StatusPopup } from "./components/StatusPopup";
import { getCurrentUpdates, getLatestCurrentUpdate } from "./lib/updates";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://artrium.space"),
  title: "Artrium Space",
  description:
    "Where art finds its place: find your people and your next opportunity in the app, step into a rotating online exhibition, and discover every studio, gallery, and resource across your city.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const latestUpdate = getLatestCurrentUpdate();
  const currentCount = getCurrentUpdates().length;
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <StatusPopup update={latestUpdate} currentCount={currentCount} />
      </body>
    </html>
  );
}
