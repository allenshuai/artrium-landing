import "server-only";
import type { NextResponse } from "next/server";
import { PORTAL_GUARDS } from "@/app/lib/security/portal-guard";

// proxy.ts gates the whole portal, but handlers and pages check the cookie
// again, with the same guard, so that a proxy bypass or a matcher mistake does
// not expose the store.

const devEx = PORTAL_GUARDS.devex;

/** Null when the dev portal cookie is valid, otherwise a 401 to return as-is. */
export function requireDevEx(): Promise<NextResponse | null> {
  return devEx.require();
}

/** For server pages: redirects to the login unless the dev portal cookie is valid. */
export function requireDevExPage(): Promise<void> {
  return devEx.requirePage();
}
