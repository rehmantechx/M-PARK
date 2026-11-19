import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/auth";
import { isValidPhone, isValidPlate, normalizePhone, parseYear, phoneVariants } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase();
    const name = String(body.name || "").trim();
    const phoneRaw = String(body.phone || "").trim();
    const otp = String(body.otp || "").trim();
    const plateRaw = String(body.plate || "").trim().toUpperCase();
    const make = String(body.make || "").trim();
    const model = String(body.model || "").trim();
    const color = String(body.color || "").trim();
    const planId = String(body.planId || "");
    if (!code || !name || !phoneRaw || !otp || !plateRaw || !make || !model || !color || !planId) {
      return NextResponse.json({ ok: false, error: "All fields are required." }, { status: 400 });
    }
    if (name.length > 100 || make.length > 50 || model.length > 50 || color.length > 30) {
      return NextResponse.json({ ok: false, error: "One of the fields is too long." }, { status: 400 });
    }
    if (!isValidPhone(phoneRaw)) return NextResponse.json({ ok: false, error: "Enter a valid Pakistani mobile number." }, { status: 400 });
    if (!isValidPlate(plateRaw)) return NextResponse.json({ ok: false, error: "Enter a valid plate, for example LEK 7982." }, { status: 400 });
    const year = parseYear(body.year);
    if (year.error || year.value === null) return NextResponse.json({ ok: false, error: year.error || "Year is required." }, { status: 400 });
    if (!/^\d{6}$/.test(otp)) return NextResponse.json({ ok: false, error: "Enter the 6 digit OTP code." }, { status: 400 });
    const phone = normalizePhone(phoneRaw);
    const plate = plateRaw;
    // Validate everything BEFORE burning the OTP.
    const qr = await db.qrCode.findUnique({ where: { code } });
    if (!qr) return NextResponse.json({ ok: false, error: "QR code not found in inventory." }, { status: 404 });
    if (qr.vehicleId) return NextResponse.json({ ok: false, error: "This QR code is already assigned to a vehicle." }, { status: 409 });
    if (qr.status !== "ACTIVE") return NextResponse.json({ ok: false, error: "This QR sticker is not active. Contact M-Park." }, { status: 409 });
    if (await db.vehicle.findUnique({ where: { plate } })) {
      return NextResponse.json({ ok: false, error: "This plate is already registered." }, { status: 409 });
    }
    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ ok: false, error: "Plan not found." }, { status: 404 });
    if (!plan.isActive) return NextResponse.json({ ok: false, error: "That plan is not active." }, { status: 400 });
    const existingUser = await db.user.findFirst({ where: { OR: phoneVariants(phone).map((v) => ({ phone: v })) }, include: { vehicles: true } });
    if (existingUser && existingUser.role !== "CUSTOMER") return NextResponse.json({ ok: false, error: "This phone belongs to an admin account." }, { status: 409 });
    if (existingUser?.isBlocked) return NextResponse.json({ ok: false, error: "This account is blocked. Contact M-Park." }, { status: 403 });
    if (existingUser && existingUser.vehicles.length > 0) return NextResponse.json({ ok: false, error: "This phone already has a registered vehicle. Log in instead." }, { status: 409 });
    const order = await db.stickerOrder.findFirst({ where: { stickerCode: code } });
    if (order && order.buyerPhone && normalizePhone(order.buyerPhone) !== phone && !phoneVariants(order.buyerPhone).includes(phone)) {
      return NextResponse.json({ ok: false, error: "This QR code was ordered for a different phone number." }, { status: 409 });
    }
    if (order && order.orderStatus === "ACTIVATED") return NextResponse.json({ ok: false, error: "This QR code is already activated." }, { status: 409 });
    const v = await verifyOtp(phone, "register", otp);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 401 });
    let userId = existingUser?.id || "";
    let userName = existingUser?.name || name;
    await db.$transaction(async (tx) => {
      const u = existingUser
        ? (existingUser.name !== name ? await tx.user.update({ where: { id: existingUser.id }, data: { name } }) : existingUser)
        : await tx.user.create({ data: { role: "CUSTOMER", name, phone } });
      userId = u.id;
      userName = u.name;
      const vehicle = await tx.vehicle.create({ data: { plate, make, model, year: year.value as number, color, ownerId: u.id } });
      await tx.qrCode.update({ where: { id: qr.id }, data: { vehicleId: vehicle.id, status: "ACTIVE", assignedAt: new Date() } });
      await tx.stickerOrder.updateMany({ where: { stickerCode: code, orderStatus: { not: "ACTIVATED" } }, data: { orderStatus: "ACTIVATED", userId: u.id, vehicleId: vehicle.id } });
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + plan.durationMonths);
      await tx.subscription.create({ data: { userId: u.id, planId: plan.id, startDate: start, endDate: end, status: "ACTIVE" } });
      await tx.notification.create({ data: { userId: u.id, title: "Welcome to M-Park", body: `Your QR sticker ${code} is active for ${plate}.` } });
    });
    const user = { id: userId, name: userName };
    await createSession({ id: user.id, role: "CUSTOMER", name: user.name, phone });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "This phone or plate is already registered." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Registration failed. Please try again." }, { status: 500 });
  }
}
