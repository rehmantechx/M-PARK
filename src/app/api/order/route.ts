import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isValidPhone, isValidPlate, normalizePhone } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const buyerName = String(body.buyerName || "").trim();
    const buyerPhoneRaw = String(body.buyerPhone || "").trim();
    const deliveryAddress = String(body.deliveryAddress || "").trim();
    const plateRaw = String(body.plate || "").trim().toUpperCase();
    const buyerEmail = String(body.buyerEmail || "").trim() || null;
    if (!buyerName || !buyerPhoneRaw || !deliveryAddress) {
      return NextResponse.json({ ok: false, error: "Name, phone and delivery address are required." }, { status: 400 });
    }
    if (buyerName.length > 100 || deliveryAddress.length > 200) return NextResponse.json({ ok: false, error: "Name or address is too long." }, { status: 400 });
    if (!isValidPhone(buyerPhoneRaw)) return NextResponse.json({ ok: false, error: "Enter a valid Pakistani mobile number." }, { status: 400 });
    if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    const buyerPhone = normalizePhone(buyerPhoneRaw);
    const plate = plateRaw || null;
    if (plate && !isValidPlate(plate)) return NextResponse.json({ ok: false, error: "Enter a valid plate, for example LEK 7982." }, { status: 400 });
    const product = await db.product.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (!product) return NextResponse.json({ ok: false, error: "Sticker sales are not open yet. Contact M-Park." }, { status: 503 });
    if (plate && (await db.vehicle.findUnique({ where: { plate } }))) {
      return NextResponse.json({ ok: false, error: "This plate is already registered." }, { status: 409 });
    }
    // Reserve a QR code atomically: create the order inside a transaction
    // and retry once if another order took the same code at the same time.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const order = await db.$transaction(async (tx) => {
          const qr = await tx.qrCode.findFirst({ where: { vehicleId: null, stickerOrder: null, status: "ACTIVE" }, orderBy: { code: "asc" } });
          if (!qr) return null;
          return tx.stickerOrder.create({
            data: { buyerName, buyerPhone, buyerEmail, deliveryAddress, plate, stickerCode: qr.code, pricePkr: product.pricePkr, paymentStatus: "UNPAID", orderStatus: "ORDERED", qrCodeId: qr.id },
          });
        });
        if (!order) return NextResponse.json({ ok: false, error: "No QR stickers left in stock. Contact M-Park." }, { status: 503 });
        return NextResponse.json({ ok: true, orderId: order.id, stickerCode: order.stickerCode, pricePkr: product.pricePkr, productName: product.name });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt === 0) continue;
        throw e;
      }
    }
    return NextResponse.json({ ok: false, error: "Could not reserve a QR sticker. Please try again." }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, error: "Order failed. Please try again." }, { status: 500 });
  }
}
