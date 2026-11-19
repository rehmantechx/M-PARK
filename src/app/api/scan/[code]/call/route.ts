import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rateLimit";

// Call Owner through M-Park Secure Relay. The scanner never sees the owner
// number and the owner never sees the scanner number. This route logs the
// call, creates a ContactRequest and notifies the owner. The live voice
// relay itself needs a telephony provider, see README.
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return NextResponse.json({ ok: false, error: "QR code is required." }, { status: 400 });
    if (rateLimited(`call:${clean}`, 10, 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many calls for this car. Wait a minute and try again." }, { status: 429 });
    }
    const qr = await db.qrCode.findUnique({ where: { code: clean }, include: { vehicle: true } });
    if (!qr || !qr.vehicle) return NextResponse.json({ ok: false, error: "This QR code is not linked to a vehicle." }, { status: 404 });
    if (qr.status !== "ACTIVE") return NextResponse.json({ ok: false, error: "This QR sticker is not active. Contact M-Park." }, { status: 400 });
    const vehicle = qr.vehicle;
    const message = "Called owner via M-Park Secure Relay.";
    await db.$transaction(async (tx) => {
      await tx.scanLog.create({ data: { vehicleId: vehicle.id, scannerName: "Anonymous", scannerPhone: "Not shared", verified: false } });
      await tx.contactRequest.create({ data: { vehicleId: vehicle.id, scannerName: "Anonymous", scannerPhone: "Not shared", message, status: "PENDING" } });
      await tx.notification.create({ data: { userId: vehicle.ownerId, title: "M-Park Secure Call", body: `Someone called you through M-Park Secure Relay for your car ${vehicle.plate}.` } });
    });
    return NextResponse.json({ ok: true, relay: "M-Park Secure Relay", maskedNumber: "+92 300 \u2022\u2022\u2022 \u2022\u2022\u2022\u2022" });
  } catch {
    return NextResponse.json({ ok: false, error: "Call failed. Please try again." }, { status: 500 });
  }
}
