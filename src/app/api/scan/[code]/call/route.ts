import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

// Call Owner through M-Park Secure Relay. The scanner never sees the owner
// number and the owner never sees the scanner number. This route logs the
// call, creates a ContactRequest and notifies the owner. The live voice
// relay itself needs a telephony provider, see README.

// Derive the display mask from the real owner number: keep the country
// code and operator prefix, replace the subscriber digits with bullets.
// A hard-coded mask would go stale the moment a real number is behind it.
function maskOwnerPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 7) return "+92 \u2022\u2022\u2022 \u2022\u2022\u2022\u2022";
  const hasCountryCode = digits.startsWith("92");
  const national = hasCountryCode ? digits.slice(2) : digits;
  const prefix = national.slice(0, 3);
  const subscriber = national.slice(3);
  const maskedSubscriber = subscriber.replace(/\d/g, "\u2022");
  return `${hasCountryCode ? "+92 " : ""}${prefix} ${maskedSubscriber}`;
}
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return NextResponse.json({ ok: false, error: "QR code is required." }, { status: 400 });
    if (rateLimited(`call:${clean}`, 10, 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many calls for this car. Wait a minute and try again." }, { status: 429 });
    }
    const qr = await db.qrCode.findUnique({ where: { code: clean }, include: { vehicle: { include: { owner: true } } } });
    if (!qr || !qr.vehicle) return NextResponse.json({ ok: false, error: "This QR code is not linked to a vehicle." }, { status: 404 });
    if (qr.status !== "ACTIVE") return NextResponse.json({ ok: false, error: "This QR sticker is not active. Contact M-Park." }, { status: 400 });
    const vehicle = qr.vehicle;
    const message = "Called owner via M-Park Secure Relay.";
    await db.$transaction(async (tx) => {
      await tx.scanLog.create({ data: { vehicleId: vehicle.id, scannerName: "Anonymous", scannerPhone: "Not shared", verified: false } });
      await tx.contactRequest.create({ data: { vehicleId: vehicle.id, scannerName: "Anonymous", scannerPhone: "Not shared", message, status: "PENDING" } });
      await tx.notification.create({ data: { userId: vehicle.ownerId, title: "M-Park Secure Call", body: `Someone called you through M-Park Secure Relay for your car ${vehicle.plate}.` } });
    });
    return NextResponse.json({ ok: true, relay: "M-Park Secure Relay", maskedNumber: maskOwnerPhone(vehicle.owner.phone) });
  } catch (e) {
    logError("api.scan_call.failed", e);
    return NextResponse.json({ ok: false, error: "Call failed. Please try again." }, { status: 500 });
  }
}
