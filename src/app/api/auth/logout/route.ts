import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("api.logout.failed", e);
    return NextResponse.json({ ok: false, error: "Logout failed." }, { status: 500 });
  }
}
