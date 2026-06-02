"use client";

import Link from "next/link";
import { TracePositionsProvider } from "../contexts/TracePositionsContext";
import { TicketPopupProvider } from "../contexts/TicketPopupContext";
import { ColorSchemeProvider, useColorScheme } from "../contexts/ColorSchemeContext";
import { ArchCursor } from "../components/ArchCursor";
import { ArtriumLogo } from "../components/ArtriumLogo";
import { BecomeTestingUserButton } from "../components/BecomeTestingUserButton";
import { HighlightParagraph } from "../components/HighlightParagraph";
import { MouseImageTrail } from "../components/MouseImageTrail";

export default function Testing() {
  return (
    <ColorSchemeProvider>
      <TestingInner />
    </ColorSchemeProvider>
  );
}

function TestingInner() {
  const { scheme } = useColorScheme();

  return (
    <TracePositionsProvider>
      <TicketPopupProvider>
      <div
        className="relative flex min-h-screen w-full flex-col items-center justify-between p-6 transition-colors duration-500"
        style={{ backgroundColor: scheme.background }}
      >
        <ArchCursor />
        <MouseImageTrail />
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-12">
            <ArtriumLogo />
            <BecomeTestingUserButton />
          </div>
        </div>
        <HighlightParagraph
          className="relative z-20 shrink-0 font-light pt-6"
          style={{ color: scheme.paragraph }}
          text="We bring together a shared space where students, artists, curators, creative professionals, and art lovers connect, discover, and grow, making the art world more accessible and visible."
        />
        <div className="relative z-20 mt-auto w-full max-w-md shrink-0 px-2 pb-1">
          <p
            className="text-center text-[11px] leading-relaxed sm:text-xs"
            style={{ color: scheme.paragraph }}
          >
            <span className="font-light" style={{ opacity: 0.6 }}>
              By continuing, you acknowledge that you read the{" "}
            </span>
            <Link
              href="/privacy"
              className="font-normal underline-offset-2 hover:underline"
              style={{ color: scheme.paragraph, opacity: 0.8 }}
            >
              Privacy Policy
            </Link>
            <span className="font-light" style={{ opacity: 0.6 }}>
              {" "}
              on how we collect and use your data.
            </span>
          </p>
        </div>
      </div>
      </TicketPopupProvider>
    </TracePositionsProvider>
  );
}
