"use client";

import {
  OUTREACH_STATUSES,
  formatOutreachDate,
  isNextActionOverdue,
  type DashboardOrg,
  type OutreachStatus,
  type Priority,
} from "@/app/lib/ticketcenter/outreach";
import { PRIORITY_COLORS, STATUS_COLORS } from "./typeColors";
import { Pill } from "./OrgPickers";
import Avatar from "./Avatar";

/** Pipeline card for one Dashboard row. Draggable between status columns in edit mode. */
export default function OrgCard({
  org,
  priority,
  lead,
  onOpen,
  onStatusChange,
}: {
  org: DashboardOrg;
  priority: Priority | "";
  lead: string | null;
  onOpen: (org: DashboardOrg) => void;
  onStatusChange: (org: DashboardOrg, status: OutreachStatus) => void;
}) {
  const overdue = isNextActionOverdue(org);
  const shownTypes = org.types.slice(0, 2);
  const moreTypes = org.types.length - shownTypes.length;
  return (
    <div
      draggable={!!lead}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", org.name);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(org)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(org);
      }}
      style={{ "--tc": STATUS_COLORS[org.status] } as React.CSSProperties}
      className={`cursor-pointer border bg-white p-3 shadow-[3px_3px_0_var(--tc)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--tc)] ${
        overdue ? "border-[#C0392B]/60" : "border-[#3F3A36]/20"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1">
        {priority && <Pill label={priority} color={PRIORITY_COLORS[priority]} />}
        {shownTypes.map((t) => (
          <span key={t} className="border border-[#3F3A36]/15 px-1.5 py-0.5 text-[10px] text-[#3F3A36]/70">
            {t}
          </span>
        ))}
        {moreTypes > 0 && <span className="text-[10px] text-[#3F3A36]/50">+{moreTypes}</span>}
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{org.name}</p>
      {(org.contactName || org.role) && (
        <p className="mt-0.5 truncate text-[11px] text-[#3F3A36]/60">
          {org.contactName}
          {org.contactName && org.role ? " · " : ""}
          {org.role}
        </p>
      )}
      {org.nextAction && (
        <p className="mt-2 line-clamp-2 border-l-2 border-[#3F3A36]/20 pl-2 text-[11px] leading-snug text-[#3F3A36]/80">
          {org.nextAction}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {org.owners.length > 0 ? (
          <div className="flex -space-x-1.5">
            {org.owners.map((name) => (
              <Avatar key={name} name={name} size={20} />
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-[#3F3A36]/40">No owner</span>
        )}
        <span
          className={`text-[11px] ${
            overdue ? "font-semibold text-[#C0392B]" : org.nextActionDate ? "text-[#3F3A36]/50" : "text-[#3F3A36]/40"
          }`}
          title={org.nextActionDate ? "Next action date" : "Last contact"}
        >
          {overdue ? "⚠ " : ""}
          {org.nextActionDate
            ? formatOutreachDate(org.nextActionDate)
            : org.lastContact
              ? `Last ${formatOutreachDate(org.lastContact)}`
              : "No date"}
        </span>
      </div>
      {lead && (
        <select
          value={org.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(org, e.target.value as OutreachStatus)}
          className="mt-2 w-full border border-[#3F3A36]/20 bg-[#FFFAF6] px-1.5 py-1 text-[11px] outline-none"
        >
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
