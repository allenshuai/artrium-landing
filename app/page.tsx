import { TracePositionsProvider } from "./contexts/TracePositionsContext";
import { ArchCursor } from "./components/ArchCursor";
import { ArtriumLogo } from "./components/ArtriumLogo";
import { BecomeTestingUserButton } from "./components/BecomeTestingUserButton";
import { MouseImageTrail } from "./components/MouseImageTrail";

export default function Home() {
  return (
    <TracePositionsProvider>
      <div
        className="relative flex min-h-screen w-full flex-col items-center justify-center p-6"
        style={{ backgroundColor: "#111111" }}
      >
        <ArchCursor />
        <MouseImageTrail />
        <div className="relative z-10 flex flex-col items-center gap-12">
          <ArtriumLogo />
          <BecomeTestingUserButton />
        </div>
      </div>
    </TracePositionsProvider>
  );
}

