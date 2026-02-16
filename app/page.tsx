import { TracePositionsProvider } from "./contexts/TracePositionsContext";
import { TicketPopupProvider } from "./contexts/TicketPopupContext";
import { ArchCursor } from "./components/ArchCursor";
import { ArtriumLogo } from "./components/ArtriumLogo";
import { BecomeTestingUserButton } from "./components/BecomeTestingUserButton";
import { MouseArchTrail } from "./components/MouseArchTrail";
import { MouseImageTrail } from "./components/MouseImageTrail";

export default function Home() {
  return (
    <TracePositionsProvider>
      <TicketPopupProvider>
      <div
        className="relative flex min-h-screen w-full flex-col items-center justify-center p-6"
        style={{ backgroundColor: "#111111" }}
      >
        <ArchCursor />
        <MouseImageTrail />
        <MouseArchTrail />
        <div className="relative z-10 flex flex-col items-center gap-12">
          <ArtriumLogo />
          <BecomeTestingUserButton />
        </div>
      </div>
      </TicketPopupProvider>
    </TracePositionsProvider>
  );
}

