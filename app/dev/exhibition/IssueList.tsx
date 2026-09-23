import type { ParseIssue } from "@/app/lib/dev/exhibition/schema";

// Presentational only, no hooks, so the client parser page and the server
// detail page both render issues the same way.
export default function IssueList({ title, issues }: { title: string; issues: ParseIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">{title}</h3>
      <ul className="mt-2 space-y-1">
        {issues.map((issue, i) => (
          <li
            key={`${issue.code}-${i}`}
            className="border-l-2 pl-3 text-sm"
            style={{ borderColor: issue.level === "error" ? "#C0392B" : "#D98C1F" }}
          >
            <span className="font-medium">{issue.level === "error" ? "Error" : "Warning"}</span>
            <span className="text-[#3F3A36]/50"> · {issue.code}</span>
            {issue.object && <span className="text-[#3F3A36]/50"> · {issue.object}</span>}
            <p className="text-[#3F3A36]/75">{issue.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
