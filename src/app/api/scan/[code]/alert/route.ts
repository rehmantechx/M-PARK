import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rateLimit";

const REASONS = ["Car is blocked", "Lights are on", "Traffic blocked", "Important message"];

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return NextResponse.json({ ok: false, error: "QR code is required." }, { status: 400 });
    if (rateLimited(`alert:${clean}`, 10, 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many alerts for this car. Wait a minute and try again." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const reasonRaw = String(body.reason || "Important message").trim();
    const reason = REASONS.includes(reasonRaw) ? reasonRaw : "Important message";
    const message = String(body.message || reason).trim().slice(0, 500);
    if (!message) return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
    const qr = await db.qrCode.findUnique({ where: { code: clean }, include: { vehicle: true } });
    if (!qr || !qr.vehicle) return NextResponse.json({ ok: false, error: "This QR code is not linked to a vehicle." }, { status: 404 });
    if (qr.status !== "ACTIVE") return NextResponse.json({ ok: false, error: "This QR sticker is not active. Contact M-Park." }, { status: 400 });
    const vehicle = qr.vehicle;
    await db.$transaction(async (tx) => {
      await tx.scanLog.create({ data: { vehicleId: vehicle.id, scannerName: "Anonymous", scannerPhone: "Not shared", verified: false } });
      await tx.contactRequest.create({ data: { vehicleId: vehicle.id, scannerName: "Anonymous", scannerPhone: "Not shared", message, status: "PENDING" } });
      await tx.notification.create({ data: { userId: vehicle.ownerId, title: "M-Park Alert", body: `Anonymous alert for your car ${vehicle.plate}: ${message}` } });
    });
    return NextResponse.json({ ok: true, message: "Alert sent anonymously." });
  } catch {
    return NextResponse.json({ ok: false, error: "Alert failed. Please try again." }, { status: 500 });
  }
}
