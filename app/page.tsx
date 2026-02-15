import { ArtriumLogo } from "./components/ArtriumLogo";
import { BecomeTestingUserButton } from "./components/BecomeTestingUserButton";

export default function Home() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-12 p-6"
      style={{ backgroundColor: "#FFF8F2" }}
    >
      <ArtriumLogo />
      <BecomeTestingUserButton />
    </div>
  );
}
