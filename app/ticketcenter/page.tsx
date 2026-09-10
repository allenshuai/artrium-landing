import { Suspense } from "react";
import { cookies } from "next/headers";
import { LEAD_COOKIE, verifyLeadToken } from "@/app/lib/ticketcenter/auth";
import { getTickets } from "@/app/lib/ticketcenter/sheets";
import type { Ticket } from "@/app/lib/ticketcenter/types";
import Board from "@/app/components/ticketcenter/Board";

export const dynamic = "force-dynamic";

export default async function TicketCenterPage() {
  const store = await cookies();
  const lead = await verifyLeadToken(store.get(LEAD_COOKIE)?.value);

  let tickets: Ticket[] = [];
  let sheetError = false;
  try {
    tickets = await getTickets();
  } catch (err) {
    console.error("[ticketcenter] initial load failed:", err);
    sheetError = true;
  }

  return (
    <Suspense>
      <Board initialTickets={tickets} initialLead={lead} initialError={sheetError} />
    </Suspense>
  );
}
