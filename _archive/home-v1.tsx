"use client";

import Link from "next/link";
import { TracePositionsProvider } from "./contexts/TracePositionsContext";
import { ColorSchemeProvider, useColorScheme } from "./contexts/ColorSchemeContext";
import { ArchCursor } from "./components/ArchCursor";
import { ArtriumLogo } from "./components/ArtriumLogo";
import { MouseImageTrail } from "./components/MouseImageTrail";

export default function Home() {
  return (
    <ColorSchemeProvider>
      <HomeInner />
    </ColorSchemeProvider>
  );
}

const LINKS = [
  {
    href: "https://apps.apple.com/us/app/artriumnow/id6765523334",
    label: "Download on App Store",
    tag: "iOS",
    highlight: "#A2DEF8",
  },
  {
    href: "https://discord.gg/KTFG92Qg",
    label: "Join our Discord",
    tag: "Community",
    highlight: "#F69C9F",
  },
  {
    href: "https://www.linkedin.com/company/artriumspace",
    label: "Follow on LinkedIn",
    tag: "Updates",
    highlight: "#FBF5AF",
  },
  {
    href: "https://docs.google.com/forms/d/e/1FAIpQLSdB-cSRNlC6fPeJ_Nw67dN2TuAlNInpVVkPCwWiZM7BSYMXLA/viewform?usp=header",
    label: "Collaborate with us",
    tag: "Partnerships",
    highlight: "#C5F9FF",
  },
];

function HomeInner() {
  const { scheme } = useColorScheme();

  return (
    <TracePositionsProvider>
      <div
        className="relative flex min-h-screen w-full flex-col items-center justify-between p-6 transition-colors duration-500"
        style={{ backgroundColor: scheme.background }}
      >
        <ArchCursor />
        <MouseImageTrail />

        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-10">
            <ArtriumLogo />

            <div className="flex flex-col items-center gap-1">
              <span
                className="text-[10px] font-light tracking-[0.3em] uppercase"
                style={{ color: scheme.paragraph, opacity: 0.4 }}
              >
                now live
              </span>
            </div>

            <div className="flex flex-col items-stretch gap-2.5 w-[17rem] sm:w-80">
              {LINKS.map((link) => (
                <ActionLink key={link.href} {...link} />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-20 mt-auto w-full max-w-md shrink-0 px-2 pb-1 flex flex-col items-center gap-1.5">
          <p
            className="text-center text-[11px] leading-relaxed sm:text-xs"
            style={{ color: scheme.paragraph }}
          >
            <span className="font-light" style={{ opacity: 0.6 }}>
              Questions? Reach us at{" "}
            </span>
            <a
              href="mailto:artrium.app@gmail.com"
              className="font-normal underline-offset-2 hover:underline"
              style={{ color: scheme.paragraph, opacity: 0.8 }}
            >
              artrium.app@gmail.com
            </a>
          </p>
          <p
            className="text-center text-[11px] leading-relaxed sm:text-xs"
            style={{ color: scheme.paragraph }}
          >
            <span className="font-light" style={{ opacity: 0.6 }}>
              By using this app, you acknowledge that you read the{" "}
            </span>
            <Link
              href="/privacy"
              className="font-normal underline-offset-2 hover:underline"
              style={{ color: scheme.paragraph, opacity: 0.8 }}
            >
              Privacy Policy
            </Link>
            <span className="font-light" style={{ opacity: 0.6 }}>
              .
            </span>
          </p>
        </div>
      </div>
    </TracePositionsProvider>
  );
}

function ActionLink({
  href,
  label,
  tag,
  highlight,
}: {
  href: string;
  label: string;
  tag: string;
  highlight: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between px-4 py-3 transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#2d363b]/20"
      style={{
        backgroundColor: "#FBF5E8",
        boxShadow:
          "inset 0 0 0 1px rgba(45, 54, 59, 0.12), inset 0 0 24px -4px rgba(45, 54, 59, 0.4), 0 4px 18px rgba(45, 54, 59, 0.1)",
      }}
    >
      <span className="relative inline-flex items-center overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100"
          aria-hidden
          style={{ backgroundColor: highlight + "aa" }}
        />
        <span
          className="relative z-10 text-sm font-semibold tracking-tight"
          style={{ color: "#2d363b" }}
        >
          {label}
        </span>
      </span>
      <span
        className="ml-4 shrink-0 text-[10px] font-light tracking-widest uppercase"
        style={{ color: "#2d363b", opacity: 0.35 }}
      >
        {tag}
      </span>
    </a>
  );
}
