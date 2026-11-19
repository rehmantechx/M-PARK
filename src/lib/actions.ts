"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession, requireAdmin, requireCustomer } from "@/lib/auth";
import { isValidPhone, isValidPlate, normalizePhone, parseIntStrict, parseMoney, parseYear, requiredText } from "@/lib/validate";

// Server actions return a result object instead of throwing, so forms can
// show a clear inline message. A thrown error is only for auth failures.

export type ActionResult = { ok: boolean; error?: string; message?: string };

function fail(error: string): ActionResult { return { ok: false, error }; }
function done(message: string, paths: string[]): ActionResult {
  for (const p of paths) revalidatePath(p);
  return { ok: true, message };
}
function prismaError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "This record already exists. Check phone, plate, or QR code.";
    if (e.code === "P2025") return "That record no longer exists. Refresh the page and try again.";
  }
  return "Something went wrong. Please try again.";
}

const ORDER_FLOW = ["ORDERED", "PRINTED", "SHIPPED", "DELIVERED", "ACTIVATED"] as const;
type OrderStatus = (typeof ORDER_FLOW)[number];

export async function adminAddCustomer(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = String(form.get("name") || "").trim();
    const phoneRaw = String(form.get("phone") || "").trim();
    const plateRaw = String(form.get("plate") || "").trim().toUpperCase();
    const make = String(form.get("make") || "").trim();
    const model = String(form.get("model") || "").trim();
    const color = String(form.get("color") || "").trim();
    const planId = String(form.get("planId") || "");
    const qrCode = String(form.get("qrCode") || "").trim().toUpperCase();
    for (const [v, f] of [[name, "Name"], [make, "Make"], [model, "Model"], [color, "Color"]] as const) {
      const err = requiredText(v, f, 100);
      if (err) return fail(err);
    }
    if (!isValidPhone(phoneRaw)) return fail("Enter a valid Pakistani mobile number, for example +92 300 1234567.");
    if (!isValidPlate(plateRaw)) return fail("Enter a valid plate, for example LEK 7982.");
    if (!planId) return fail("Choose a plan.");
    if (!qrCode) return fail("Choose a QR code.");
    const year = parseYear(form.get("year"));
    if (year.error || year.value === null) return fail(year.error || "Year is required.");
    const phone = normalizePhone(phoneRaw);
    const plate = plateRaw;
    await db.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan || !plan.isActive) throw new Error("Plan not found or inactive. Choose an active plan.");
      if (await tx.user.findUnique({ where: { phone } })) throw new Error("A customer with this phone already exists.");
      if (await tx.vehicle.findUnique({ where: { plate } })) throw new Error("This plate is already registered.");
      const qr = await tx.qrCode.findUnique({ where: { code: qrCode } });
      if (!qr) throw new Error("QR code not found in inventory.");
      if (qr.vehicleId) throw new Error("QR code is already assigned.");
      if (qr.status !== "ACTIVE") throw new Error("That QR code is not active. Choose an active code.");
      const user = await tx.user.create({ data: { role: "CUSTOMER", name, phone } });
      const vehicle = await tx.vehicle.create({ data: { plate, make, model, year: year.value as number, color, ownerId: user.id } });
      await tx.qrCode.update({ where: { id: qr.id }, data: { vehicleId: vehicle.id, status: "ACTIVE", assignedAt: new Date() } });
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + plan.durationMonths);
      await tx.subscription.create({ data: { userId: user.id, planId: plan.id, startDate: start, endDate: end, status: "ACTIVE" } });
      await tx.notification.create({ data: { userId: user.id, title: "Welcome to M-Park", body: `Your QR sticker ${qrCode} is active for ${plate}.` } });
    });
    return done("Customer added.", ["/admin/customers", "/admin", "/admin/vehicles", "/admin/qr-codes", "/admin/inventory", "/admin/subscriptions"]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("Plan not found") || msg.startsWith("A customer with") || msg.startsWith("This plate") || msg.startsWith("QR code")) return fail(msg);
    return fail(prismaError(e));
  }
}

export async function adminToggleBlock(userId: string, blocked: boolean): Promise<ActionResult> {
  try {
    const s = await requireAdmin();
    if (!userId) return fail("Customer is required.");
    if (userId === s.id) return fail("You cannot block your own account.");
    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return fail("That customer no longer exists.");
    if (target.role === "ADMIN") return fail("Admin accounts cannot be blocked here.");
    await db.user.update({ where: { id: userId }, data: { isBlocked: blocked } });
    return done(blocked ? "Customer blocked." : "Customer unblocked.", ["/admin/customers", "/admin"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminQrStatus(qrId: string, status: "ACTIVE" | "INACTIVE" | "LOST"): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!["ACTIVE", "INACTIVE", "LOST"].includes(status)) return fail("Invalid QR status.");
    const qr = await db.qrCode.findUnique({ where: { id: qrId }, include: { vehicle: true } });
    if (!qr) return fail("That QR code no longer exists.");
    if (qr.status === status) return fail(`QR code is already ${status}.`);
    if (qr.vehicleId && status !== "ACTIVE") {
      const vehicle = await db.vehicle.findUnique({ where: { id: qr.vehicleId } });
      if (!vehicle) return fail("That QR code is linked to a vehicle that no longer exists.");
      const activeSub = await db.subscription.findFirst({ where: { userId: vehicle.ownerId, status: "ACTIVE", endDate: { gt: new Date() } } });
      if (activeSub) return fail("That sticker is linked to a vehicle with an active subscription. Remove the subscription first.");
    }
    await db.qrCode.update({ where: { id: qrId }, data: { status } });
    return done(`QR code marked ${status}.`, ["/admin/qr-codes", "/admin", "/admin/customers", "/admin/vehicles", "/admin/inventory"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminGenerateBatch(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const countRaw = parseIntStrict(form.get("count"), "Batch size");
    if (countRaw.error || countRaw.value === null) return fail(countRaw.error || "Batch size is required.");
    const n = Math.min(Math.max(countRaw.value, 1), 200);
    const codes = await db.qrCode.findMany({ select: { code: true } });
    let maxNum = 1000;
    for (const c of codes) {
      const m = c.code.match(/^MPK-(\d+)$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    const batchNums = await db.qrCode.findMany({ select: { batch: true }, distinct: ["batch"] });
    let maxBatch = 0;
    for (const b of batchNums) { const m = b.batch.match(/^B-(\d+)$/); if (m) maxBatch = Math.max(maxBatch, Number(m[1])); }
    // Retry once if another admin generated a batch at the same moment
    // and took the same code numbers. The unique code constraint is the
    // final guard, and the retry recomputes the next numbers.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        const fresh = await db.qrCode.findMany({ select: { code: true } });
        for (const c of fresh) {
          const m = c.code.match(/^MPK-(\d+)$/);
          if (m) maxNum = Math.max(maxNum, Number(m[1]));
        }
      }
      const batch = `B-${String(maxBatch + 1 + attempt).padStart(3, "0")}`;
      const startNum = maxNum + 1;
      try {
        await db.$transaction(async (tx) => {
          for (let i = 0; i < n; i++) {
            await tx.qrCode.create({ data: { code: `MPK-${startNum + i}`, batch, status: "ACTIVE" } });
          }
        });
        return done(`${n} QR codes created in batch ${batch}.`, ["/admin/inventory", "/admin/qr-codes", "/admin"]);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt === 0) continue;
        throw e;
      }
    }
    return fail("Could not generate a batch. Another batch was created at the same time. Try again.");
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminPlanCreate(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const err = requiredText(name, "Plan name", 100);
    if (err) return fail(err);
    const price = parseMoney(form.get("pricePkr"), "Price");
    if (price.error || price.value === null) return fail(price.error || "Price is required.");
    const dur = parseIntStrict(form.get("durationMonths"), "Duration");
    if (dur.error || dur.value === null) return fail(dur.error || "Duration is required.");
    if (dur.value < 1 || dur.value > 120) return fail("Duration must be between 1 and 120 months.");
    const existing = (await db.subscriptionPlan.findMany({ select: { name: true } })).find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing) return fail("A plan with this name already exists.");
    await db.subscriptionPlan.create({ data: { name, pricePkr: price.value, durationMonths: dur.value, description: description || null } });
    return done("Plan created.", ["/admin/subscriptions"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminPlanUpdate(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(form.get("id") || "");
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const isActive = String(form.get("isActive") || "true") === "true";
    if (!id) return fail("Plan is required.");
    const price = parseMoney(form.get("pricePkr"), "Price");
    if (price.error || price.value === null) return fail(price.error || "Price is required.");
    const dur = parseIntStrict(form.get("durationMonths"), "Duration");
    if (dur.error || dur.value === null) return fail(dur.error || "Duration is required.");
    if (dur.value < 1 || dur.value > 120) return fail("Duration must be between 1 and 120 months.");
    const err = requiredText(name, "Plan name", 100);
    if (err) return fail(err);
    const plan = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return fail("That plan no longer exists.");
    const dup = (await db.subscriptionPlan.findMany({ select: { id: true, name: true } })).find((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase());
    if (dup) return fail("A plan with this name already exists.");
    await db.subscriptionPlan.update({ where: { id }, data: { pricePkr: price.value, isActive, name, durationMonths: dur.value, description: description || null } });
    return done("Plan saved.", ["/admin/subscriptions", "/admin/customers"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminCustomerUpdate(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const userId = String(form.get("userId") || "");
    const vehicleId = String(form.get("vehicleId") || "");
    const name = String(form.get("name") || "").trim();
    const phoneRaw = String(form.get("phone") || "").trim();
    const plateRaw = String(form.get("plate") || "").trim().toUpperCase();
    const make = String(form.get("make") || "").trim();
    const model = String(form.get("model") || "").trim();
    const color = String(form.get("color") || "").trim();
    if (!userId) return fail("Customer is required.");
    for (const [v, f] of [[name, "Name"], [make, "Make"], [model, "Model"], [color, "Color"]] as const) {
      const err = requiredText(v, f, 100);
      if (err) return fail(err);
    }
    if (!isValidPhone(phoneRaw)) return fail("Enter a valid Pakistani mobile number.");
    if (!isValidPlate(plateRaw)) return fail("Enter a valid plate.");
    const year = parseYear(form.get("year"));
    if (year.error || year.value === null) return fail(year.error || "Year is required.");
    const phone = normalizePhone(phoneRaw);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return fail("That customer no longer exists.");
    if (phone !== user.phone && (await db.user.findUnique({ where: { phone } }))) return fail("A customer with this phone already exists.");
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { name, phone } });
      if (vehicleId) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle || vehicle.ownerId !== userId) throw new Error("Vehicle not found.");
        if (plateRaw !== vehicle.plate && (await tx.vehicle.findUnique({ where: { plate: plateRaw } }))) throw new Error("This plate is already registered.");
        await tx.vehicle.update({ where: { id: vehicleId }, data: { plate: plateRaw, make, model, year: year.value as number, color } });
      }
    });
    return done("Customer saved.", ["/admin/customers", "/admin", "/admin/vehicles"]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Vehicle not found." || msg === "This plate is already registered.") return fail(msg);
    return fail(prismaError(e));
  }
}

export async function customerUpdateVehicle(form: FormData): Promise<ActionResult> {
  try {
    const s = await requireCustomer();
    const vehicleId = String(form.get("vehicleId") || "");
    const plateRaw = String(form.get("plate") || "").trim().toUpperCase();
    const make = String(form.get("make") || "").trim();
    const model = String(form.get("model") || "").trim();
    const color = String(form.get("color") || "").trim();
    if (!vehicleId) return fail("Vehicle is required.");
    for (const [v, f] of [[make, "Make"], [model, "Model"], [color, "Color"]] as const) {
      const err = requiredText(v, f, 100);
      if (err) return fail(err);
    }
    if (!isValidPlate(plateRaw)) return fail("Enter a valid plate, for example LEK 7982.");
    const year = parseYear(form.get("year"));
    if (year.error || year.value === null) return fail(year.error || "Year is required.");
    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.ownerId !== s.id) return fail("Vehicle not found.");
    if (plateRaw !== vehicle.plate && (await db.vehicle.findUnique({ where: { plate: plateRaw } }))) return fail("This plate is already registered.");
    await db.vehicle.update({ where: { id: vehicleId }, data: { plate: plateRaw, make, model, year: year.value as number, color } });
    return done("Vehicle saved.", ["/customer", "/customer/vehicle"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function customerEmergencyUpsert(form: FormData): Promise<ActionResult> {
  try {
    const s = await requireCustomer();
    const name = String(form.get("name") || "").trim();
    const phoneRaw = String(form.get("phone") || "").trim();
    const relationship = String(form.get("relationship") || "").trim();
    const err = requiredText(name, "Emergency contact name", 100);
    if (err) return fail(err);
    if (!isValidPhone(phoneRaw)) return fail("Enter a valid Pakistani mobile number for the emergency contact.");
    if (relationship.length > 50) return fail("Relationship must be 50 characters or less.");
    await db.emergencyContact.upsert({
      where: { userId: s.id },
      create: { userId: s.id, name, phone: normalizePhone(phoneRaw), relationship: relationship || null },
      update: { name, phone: normalizePhone(phoneRaw), relationship: relationship || null },
    });
    return done("Emergency contact saved.", ["/customer/emergency"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function customerEmergencyDelete(): Promise<ActionResult> {
  try {
    const s = await requireCustomer();
    const existing = await db.emergencyContact.findUnique({ where: { userId: s.id } });
    if (!existing) return fail("No emergency contact to remove.");
    await db.emergencyContact.delete({ where: { userId: s.id } });
    return done("Emergency contact removed.", ["/customer/emergency"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function customerRequestAction(requestId: string, status: "APPROVED" | "IGNORED"): Promise<ActionResult> {
  try {
    const s = await requireCustomer();
    if (!["APPROVED", "IGNORED"].includes(status)) return fail("Invalid request action.");
    const req = await db.contactRequest.findUnique({ where: { id: requestId }, include: { vehicle: true } });
    if (!req || req.vehicle.ownerId !== s.id) return fail("Request not found.");
    if (req.status !== "PENDING") return fail(`This request is already ${req.status.toLowerCase()}.`);
    await db.contactRequest.update({ where: { id: requestId }, data: { status } });
    return done(status === "APPROVED" ? "Request approved." : "Request ignored.", ["/customer/requests", "/customer"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminRequestAction(requestId: string, status: "APPROVED" | "IGNORED"): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!["APPROVED", "IGNORED"].includes(status)) return fail("Invalid request action.");
    const req = await db.contactRequest.findUnique({ where: { id: requestId } });
    if (!req) return fail("Request not found.");
    if (req.status !== "PENDING") return fail(`This request is already ${req.status.toLowerCase()}.`);
    await db.contactRequest.update({ where: { id: requestId }, data: { status } });
    return done(status === "APPROVED" ? "Request approved." : "Request ignored.", ["/admin/requests", "/admin"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminOrderPayment(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(form.get("id") || "");
    const paymentStatus = String(form.get("paymentStatus") || "") as "PAID" | "UNPAID";
    if (!id || (paymentStatus !== "PAID" && paymentStatus !== "UNPAID")) return fail("Order and payment status are required.");
    const order = await db.stickerOrder.findUnique({ where: { id } });
    if (!order) return fail("That order no longer exists.");
    if (paymentStatus === "UNPAID" && order.orderStatus === "ACTIVATED") return fail("An activated order cannot be marked unpaid. Change the order status first.");
    await db.stickerOrder.update({ where: { id }, data: { paymentStatus } });
    return done(paymentStatus === "PAID" ? "Order marked paid." : "Order marked unpaid.", ["/admin/orders", "/admin"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminOrderStatus(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(form.get("id") || "");
    const orderStatus = String(form.get("orderStatus") || "") as OrderStatus;
    if (!id || !ORDER_FLOW.includes(orderStatus)) return fail("Order and order status are required.");
    const order = await db.stickerOrder.findUnique({ where: { id } });
    if (!order) return fail("That order no longer exists.");
    const current = ORDER_FLOW.indexOf(order.orderStatus as OrderStatus);
    const next = ORDER_FLOW.indexOf(orderStatus);
    if (next < current) return fail("Order status cannot move backwards. Use the current or next step.");
    if (orderStatus === "ACTIVATED" && order.paymentStatus !== "PAID") return fail("An order can only be activated after payment is marked paid.");
    await db.stickerOrder.update({ where: { id }, data: { orderStatus } });
    return done("Order status saved.", ["/admin/orders", "/admin"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function adminProductPrice(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = String(form.get("id") || "");
    const price = parseMoney(form.get("pricePkr"), "Price");
    if (!id) return fail("Product is required.");
    if (price.error || price.value === null) return fail(price.error || "Price is required.");
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return fail("That product no longer exists.");
    await db.product.update({ where: { id }, data: { pricePkr: price.value } });
    return done("Sticker price saved. It applies to new orders only.", ["/admin/orders", "/admin"]);
  } catch (e) { return fail(prismaError(e)); }
}

export async function markNotificationsRead(): Promise<ActionResult> {
  try {
    const s = await getSession();
    if (!s) return fail("Login required.");
    await db.notification.updateMany({ where: { userId: s.id, isRead: false }, data: { isRead: true } });
    return done("All notifications marked read.", ["/customer/notifications", "/admin/notifications"]);
  } catch (e) { return fail(prismaError(e)); }
}
