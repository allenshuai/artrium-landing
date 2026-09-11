import type { TicketType } from "@/app/lib/ticketcenter/types";
import type { MeetingStatus } from "@/app/lib/ticketcenter/meetings";

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

export const INK = "#3F3A36";
export const CREAM = "#FFFAF6";
