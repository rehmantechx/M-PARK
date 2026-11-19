import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return NextResponse.json({ ok: false, error: "QR code is required." }, { status: 400 });
    const qr = await db.qrCode.findUnique({ where: { code: clean }, include: { vehicle: true } });
    if (!qr) return NextResponse.json({ ok: false, error: "QR code not found." }, { status: 404 });
    return NextResponse.json({ ok: true, code: qr.code, batch: qr.batch, status: qr.status, assigned: Boolean(qr.vehicleId), vehiclePlate: qr.vehicle?.plate || null });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not look up this QR code." }, { status: 500 });
  }
}
