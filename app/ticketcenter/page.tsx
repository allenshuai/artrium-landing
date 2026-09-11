import { Suspense } from "react";
import { cookies } from "next/headers";
import { LEAD_COOKIE, verifyLeadToken } from "@/app/lib/ticketcenter/auth";
import { getMeetings, getTickets } from "@/app/lib/ticketcenter/sheets";
import type { Ticket } from "@/app/lib/ticketcenter/types";
import type { Meeting } from "@/app/lib/ticketcenter/meetings";
import Board from "@/app/components/ticketcenter/Board";

export const dynamic = "force-dynamic";

export default async function TicketCenterPage() {
  const store = await cookies();
  const lead = await verifyLeadToken(store.get(LEAD_COOKIE)?.value);

  let tickets: Ticket[] = [];
  let meetings: Meeting[] = [];
  let sheetError = false;
  const [t, m] = await Promise.allSettled([getTickets(), getMeetings()]);
  if (t.status === "fulfilled") tickets = t.value;
  else {
    console.error("[ticketcenter] initial ticket load failed:", t.reason);
    sheetError = true;
  }
  if (m.status === "fulfilled") meetings = m.value;
  else console.error("[ticketcenter] initial meeting load failed:", m.reason);

  return (
    <Suspense>
      <Board
        initialTickets={tickets}
        initialMeetings={meetings}
        initialLead={lead}
        initialError={sheetError}
      />
    </Suspense>
  );
}
