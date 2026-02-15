import { ArchGrid } from "./components/ArchGrid";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f0e8] dark:bg-zinc-950">
      <section className="flex h-screen w-full flex-col items-center justify-center overflow-hidden">
        <ArchGrid />
      </section>
    </div>
  );
}
