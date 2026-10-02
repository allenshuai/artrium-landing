import type { TicketType } from "@/app/lib/ticketcenter/types";
import type { MeetingStatus } from "@/app/lib/ticketcenter/meetings";
import type { OutreachStatus, Priority } from "@/app/lib/ticketcenter/outreach";

// One color per ticket type, used everywhere a type chip appears.
export const TYPE_COLORS: Record<TicketType, string> = {
  design: "#F69C9F",
  frontend: "#A2DEF8",
  backend: "#B7E4C7",
  outreach: "#FBF5AF",
  marketing: "#E4C1F9",
  admin: "#E0DBD6",
};

export const MEETING_COLORS: Record<MeetingStatus, string> = {
  Scheduling: "#FBF5AF",
  Scheduled: "#B7E4C7",
  Done: "#E0DBD6",
};

export const STATUS_COLORS: Record<OutreachStatus, string> = {
  "Not Started": "#E0DBD6",
  "Drafting Outreach": "#FBF5AF",
  Contacted: "#A2DEF8",
  "Follow-up Sent": "#A2DEF8",
  "Replied - Discussing": "#E4C1F9",
  "Meeting Scheduled": "#E4C1F9",
  "Partnership Agreed": "#B7E4C7",
  "Active Partner": "#B7E4C7",
  Declined: "#F69C9F",
  "No Response": "#E0DBD6",
};

export const PRIORITY_COLORS: Record<Priority | "", string> = {
  High: "#F69C9F",
  Medium: "#FBF5AF",
  Low: "#A2DEF8",
  "": "#E0DBD6",
};

export const INK = "#3F3A36";
export const CREAM = "#FFFAF6";
