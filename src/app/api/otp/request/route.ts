import { NextResponse } from "next/server";
import { createOtp } from "@/lib/otp";
import { isValidPhone, normalizePhone } from "@/lib/validate";
import { rateLimited } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const phoneRaw = String(body.phone || "").trim();
    const purpose = String(body.purpose || "login").trim();
    if (!["login", "register"].includes(purpose)) return NextResponse.json({ ok: false, error: "Invalid OTP purpose." }, { status: 400 });
    if (!isValidPhone(phoneRaw)) return NextResponse.json({ ok: false, error: "Enter a valid Pakistani mobile number, for example +92 300 1234567." }, { status: 400 });
    const phone = normalizePhone(phoneRaw);
    if (rateLimited(`otp:${phone}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many OTP requests for this number. Wait an hour and try again." }, { status: 429 });
    }
    const result = await createOtp(phone, purpose);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.note || "Could not send OTP." }, { status: 503 });
    return NextResponse.json({ ok: true, smsSent: result.smsSent, provider: result.provider, note: result.note, devCode: result.devCode });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not send OTP. Please try again." }, { status: 500 });
  }
}
