import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isValidPhone, isValidPlate, normalizePhone } from "@/lib/validate";

// SQLite allows one writer at a time. Queue order reservations in this
// process so concurrent orders do not time out waiting for the database.
// On Postgres with several servers this must become a database lock,
// for example SELECT ... FOR UPDATE on the QR row, instead of this mutex.
let orderMutex: Promise<unknown> = Promise.resolve();

function withOrderLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = orderMutex.then(fn, fn);
  orderMutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

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
    // Reserve a QR code atomically: create the order inside a transaction.
    // Two orders at the same moment can pick the same free code, or SQLite
    // can lock the database for one writer. Both are transient, so retry
    // with a short backoff. The unique stickerCode and qrCodeId are the
    // final guards, so two orders can never share a QR code.
    return withOrderLock(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const order = await db.$transaction(async (tx) => {
          const qr = await tx.qrCode.findFirst({ where: { vehicleId: null, stickerOrder: null, status: "ACTIVE" }, orderBy: { code: "asc" } });
          if (!qr) return null;
          return tx.stickerOrder.create({
            data: { buyerName, buyerPhone, buyerEmail, deliveryAddress, plate, stickerCode: qr.code, pricePkr: product.pricePkr, paymentStatus: "UNPAID", orderStatus: "ORDERED", qrCodeId: qr.id },
          });
        }, { timeout: 10000, maxWait: 5000 });
        if (!order) return NextResponse.json({ ok: false, error: "No QR stickers left in stock. Contact M-Park." }, { status: 503 });
        return NextResponse.json({ ok: true, orderId: order.id, stickerCode: order.stickerCode, pricePkr: product.pricePkr, productName: product.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const lower = msg.toLowerCase();
        const retryable =
          (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) ||
          lower.includes("database is locked") || lower.includes("transaction") || lower.includes("timeout");
        if (retryable && attempt < 3) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    return NextResponse.json({ ok: false, error: "Could not reserve a QR sticker. Please try again." }, { status: 503 });
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Order failed. Please try again." }, { status: 500 });
  }
}
