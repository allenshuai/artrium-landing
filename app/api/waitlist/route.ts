import { NextResponse } from "next/server";

const SCRIPT_URL =
  process.env.WAITLIST_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbwO7RvHH5ztrppin3DlFNAdC2kgyPt9k-mrj6UK1-pEK36I2Os-ToLxv4UMPXadKQdX-A/exec";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    if (!name || !email) {
      return NextResponse.json({ ok: false, error: "Missing name or email" }, { status: 400 });
    }

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        name,
        email,
        source: "artrium.space",
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Script HTTP ${res.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }

    let data: { ok?: boolean; error?: string };
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid response from script" },
        { status: 502 }
      );
    }

    if (data?.ok !== true) {
      return NextResponse.json(
        { ok: false, error: data?.error ?? "Script returned error" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
