import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";
import { rateLimited } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    if (email.length > 100 || password.length > 100) return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    const ip = req.headers.get("x-forwarded-for") || "local";
    if (rateLimited(`admin-login:${ip}:${email}`, 10, 5 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many login attempts. Wait 5 minutes and try again." }, { status: 429 });
    }
    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.role !== "ADMIN" || !user.passwordHash) {
      return NextResponse.json({ ok: false, error: "Wrong email or password." }, { status: 401 });
    }
    if (user.isBlocked) return NextResponse.json({ ok: false, error: "This account is blocked." }, { status: 403 });
    const valid = await checkPassword(password, user.passwordHash);
    if (!valid) return NextResponse.json({ ok: false, error: "Wrong email or password." }, { status: 401 });
    await createSession({ id: user.id, role: "ADMIN", name: user.name, phone: user.phone });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Login failed. Please try again." }, { status: 500 });
  }
}
