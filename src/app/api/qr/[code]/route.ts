import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, rateLimited } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return NextResponse.json({ ok: false, error: "QR code is required." }, { status: 400 });
    if (rateLimited(`qr:${getClientIp(req)}`, 60, 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Too many lookups. Wait a minute and try again." }, { status: 429 });
    }
    const qr = await db.qrCode.findUnique({ where: { code: clean }, include: { vehicle: true } });
    if (!qr) return NextResponse.json({ ok: false, error: "QR code not found." }, { status: 404 });
    return NextResponse.json({ ok: true, code: qr.code, batch: qr.batch, status: qr.status, assigned: Boolean(qr.vehicleId), vehiclePlate: qr.vehicle?.plate || null });
  } catch (e) {
    logError("api.qr_lookup.failed", e);
    return NextResponse.json({ ok: false, error: "Could not look up this QR code." }, { status: 500 });
  }
}
