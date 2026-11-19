import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/auth";
import { isValidPhone, normalizePhone, phoneVariants } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const phoneRaw = String(body.phone || "").trim();
    const code = String(body.code || "").trim();
    if (!phoneRaw || !code) return NextResponse.json({ ok: false, error: "Phone and OTP are required." }, { status: 400 });
    if (!isValidPhone(phoneRaw)) return NextResponse.json({ ok: false, error: "Enter a valid Pakistani mobile number." }, { status: 400 });
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: "Enter the 6 digit OTP code." }, { status: 400 });
    const phone = normalizePhone(phoneRaw);
    const user = await db.user.findFirst({ where: { OR: phoneVariants(phone).map((v) => ({ phone: v })) } });
    if (!user || user.role !== "CUSTOMER") {
      return NextResponse.json({ ok: false, error: "No customer account exists for this phone. Register first." }, { status: 404 });
    }
    if (user.isBlocked) return NextResponse.json({ ok: false, error: "This account is blocked. Contact M-Park." }, { status: 403 });
    const v = await verifyOtp(phone, "login", code);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 401 });
    await createSession({ id: user.id, role: "CUSTOMER", name: user.name, phone: user.phone });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Login failed. Please try again." }, { status: 500 });
  }
}
