export default function ProgressBar({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden bg-[#3F3A36]/15 align-middle">
      <span
        className="block h-full bg-[#3F3A36] transition-all"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
