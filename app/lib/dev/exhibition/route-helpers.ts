import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { DEV_EX_COOKIE, verifyDevExToken } from "./auth";

// proxy.ts gates the whole portal, but handlers and pages check the cookie
// again so that a proxy bypass or a matcher mistake does not expose the store.

async function hasDevEx(): Promise<boolean> {
  const store = await cookies();
  return verifyDevExToken(store.get(DEV_EX_COOKIE)?.value);
}

/** Null when the dev portal cookie is valid, otherwise a 401 to return as-is. */
export async function requireDevEx(): Promise<NextResponse | null> {
  if (await hasDevEx()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** For server pages: redirects to the login unless the dev portal cookie is valid. */
export async function requireDevExPage(): Promise<void> {
  if (!(await hasDevEx())) redirect("/dev/exhibition/login");
}
