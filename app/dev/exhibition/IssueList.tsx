import { isParseIssue } from "@/app/lib/exhibition-map/schema";

const LEVELS = {
  error: { label: "Error", color: "#C0392B" },
  warning: { label: "Warning", color: "#D98C1F" },
  // Not a finding: a note about the list, such as a truncation on save.
  info: { label: "Note", color: "rgba(63, 58, 54, 0.35)" },
} as const;

// Presentational only, no hooks, so the client parser page and the server
// detail page both render issues the same way. Stored issues are untrusted: a
// document saved before they were validated can hold anything, so malformed
// entries are counted and skipped rather than rendered.
export default function IssueList({ title, issues }: { title: string; issues: readonly unknown[] }) {
  const all = Array.isArray(issues) ? issues : [];
  if (all.length === 0) return null;
  const valid = all.filter(isParseIssue);
  const skipped = all.length - valid.length;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">{title}</h3>
      <ul className="mt-2 space-y-1">
        {valid.map((issue, i) => (
          <li
            key={`${issue.code}-${i}`}
            className="border-l-2 pl-3 text-sm"
            style={{ borderColor: LEVELS[issue.level].color }}
          >
            <span className="font-medium">{LEVELS[issue.level].label}</span>
            <span className="text-[#3F3A36]/50"> · {issue.code}</span>
            {issue.object && <span className="text-[#3F3A36]/50"> · {issue.object}</span>}
            <p className="text-[#3F3A36]/75">{issue.message}</p>
          </li>
        ))}
      </ul>
      {skipped > 0 && (
        <p className="mt-2 text-sm text-[#3F3A36]/50">
          {skipped} malformed {skipped === 1 ? "entry" : "entries"} not shown.
        </p>
      )}
    </div>
  );
}
