import { Suspense } from "react";
import { cookies } from "next/headers";
import { LEAD_COOKIE, verifyLeadToken } from "@/app/lib/ticketcenter/auth";
import { getDashboard, getDirectory } from "@/app/lib/ticketcenter/outreach-sheets";
import type { DashboardOrg, DirectoryOrg } from "@/app/lib/ticketcenter/outreach";
import OutreachBoard from "@/app/components/ticketcenter/OutreachBoard";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const store = await cookies();
  const lead = await verifyLeadToken(store.get(LEAD_COOKIE)?.value);

  let directory: DirectoryOrg[] = [];
  let dashboard: DashboardOrg[] = [];
  let sheetError = false;
  const [d, b] = await Promise.allSettled([getDirectory(), getDashboard()]);
  if (d.status === "fulfilled") directory = d.value;
  else {
    console.error("[outreach] initial directory load failed:", d.reason);
    sheetError = true;
  }
  if (b.status === "fulfilled") dashboard = b.value;
  else {
    console.error("[outreach] initial dashboard load failed:", b.reason);
    sheetError = true;
  }

  return (
    <Suspense>
      <OutreachBoard
        initialDirectory={directory}
        initialDashboard={dashboard}
        initialLead={lead}
        initialError={sheetError}
      />
    </Suspense>
  );
}
