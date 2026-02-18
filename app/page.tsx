 "use client";

import { TracePositionsProvider } from "./contexts/TracePositionsContext";
import { TicketPopupProvider } from "./contexts/TicketPopupContext";
import { ColorSchemeProvider, useColorScheme } from "./contexts/ColorSchemeContext";
import { ArchCursor } from "./components/ArchCursor";
import { ArtriumLogo } from "./components/ArtriumLogo";
import { BecomeTestingUserButton } from "./components/BecomeTestingUserButton";
import { HighlightParagraph } from "./components/HighlightParagraph";
import { MouseArchTrail } from "./components/MouseArchTrail";
import { MouseImageTrail } from "./components/MouseImageTrail";

export default function Home() {
  return (
    <ColorSchemeProvider>
      <HomeInner />
    </ColorSchemeProvider>
  );
}

function HomeInner() {
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
        <MouseArchTrail />
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
      </div>
      </TicketPopupProvider>
    </TracePositionsProvider>
  );
}
