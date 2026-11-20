import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";

const BASE_URL = "http://localhost:3000";
const ADMIN_EMAIL = "admin@m-park.example";
const ADMIN_PASSWORD = "Admin1234!";
const CUSTOMER_PHONE = "+92 300 1234567";
const SEEDED_VEHICLE_PLATE = "LEA-24-1234";

// Unique per run so repeated test runs never collide on unique columns.
const runSuffix = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 10)}`;
const runQr = (n: string) => `MPK-9${runSuffix}${n}`;
const runPhone = (prefix: string) => `+92${prefix}${runSuffix}`;

const fixtures = {
  runSuffix,
  freeCodes: [runQr("1"), runQr("2"), runQr("3"), runQr("4")],
  lostCode: runQr("9"),
  rateQr: runQr("8"),
  ratePhone: runPhone("303"),
  verifyPhone: runPhone("304"),
  blockPhone: runPhone("301"),
  editPhone: runPhone("302"),
  editPlate: `QE-${runSuffix}`,
  registerPhone: runPhone("300"),
  registerPlate: `RQ-${runSuffix}`,
  seededCustomerPhone: CUSTOMER_PHONE,
  seededVehiclePlate: SEEDED_VEHICLE_PLATE,
  qaScannerPhone: "+92 300 1110000",
  foreignPlate: "ISB-22-5678",
  foreignPhone: "+92 321 7654321",
  foreignName: "Ayesha Khan",
};

async function loginAdmin(): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/admin-login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) throw new Error(`Global setup: admin login failed with ${res.status()}`);
  await ctx.storageState({ path: path.join(".auth", "admin.json") });
  await ctx.dispose();
}

async function loginCustomer(): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const otpRes = await ctx.post("/api/otp/request", { data: { phone: CUSTOMER_PHONE } });
  if (!otpRes.ok()) throw new Error(`Global setup: OTP request failed with ${otpRes.status()}`);
  const { devCode } = (await otpRes.json()) as { devCode?: string };
  if (!devCode) throw new Error("Global setup: no devCode returned for seeded customer");
  const verifyRes = await ctx.post("/api/otp/verify-customer", {
    data: { phone: CUSTOMER_PHONE, code: devCode },
  });
  if (!verifyRes.ok()) throw new Error(`Global setup: OTP verify failed with ${verifyRes.status()}`);
  await ctx.storageState({ path: path.join(".auth", "customer.json") });
  await ctx.dispose();
}

async function seedFixtures(): Promise<void> {
  // Keep enough free QR stock so order tests never run out of codes.
  const freeStock = await db.qrCode.count({ where: { status: "ACTIVE", vehicleId: null } });
  if (freeStock < 25) {
    const start = 900000 + (Date.now() % 90000);
    const codes = Array.from({ length: 50 }, (_, i) => `MPK-${start + i}`);
    // SQLite has no createMany skipDuplicates, so filter existing codes here.
    const existing = await db.qrCode.findMany({ where: { code: { in: codes } }, select: { code: true } });
    const have = new Set(existing.map((r) => r.code));
    const missing = codes.filter((code) => !have.has(code));
    if (missing.length) {
      await db.qrCode.createMany({
        data: missing.map((code) => ({ code, batch: "B-QA", status: "ACTIVE" as const })),
      });
    }
  }

  // Run-specific QR codes for register and QR-status tests. Upserts keep
  // repeated runs safe even if a run suffix ever collides with an older run.
  for (const code of fixtures.freeCodes) {
    await db.qrCode.upsert({
      where: { code },
      update: { status: "ACTIVE", vehicleId: null, assignedAt: null },
      create: { code, batch: `QA-${runSuffix}`, status: "ACTIVE" },
    });
  }
  await db.qrCode.upsert({
    where: { code: fixtures.lostCode },
    update: { status: "LOST", vehicleId: null, assignedAt: null },
    create: { code: fixtures.lostCode, batch: `QA-${runSuffix}`, status: "LOST" },
  });

  // Dedicated customer, vehicle, and assigned QR for scan rate limit tests.
  const rateUser = await db.user.upsert({
    where: { phone: fixtures.ratePhone },
    update: {},
    create: { role: "CUSTOMER", name: "QA Rate Test", phone: fixtures.ratePhone },
  });
  const rateVehicle = await db.vehicle.upsert({
    where: { plate: `QA-${runSuffix}` },
    update: {},
    create: {
      plate: `QA-${runSuffix}`,
      make: "Test",
      model: "Car",
      year: 2024,
      color: "White",
      ownerId: rateUser.id,
    },
  });
  await db.qrCode.upsert({
    where: { code: fixtures.rateQr },
    update: { vehicleId: rateVehicle.id, status: "ACTIVE" },
    create: {
      code: fixtures.rateQr,
      batch: `QA-${runSuffix}`,
      status: "ACTIVE",
      vehicleId: rateVehicle.id,
      assignedAt: new Date(),
    },
  });

  // Fixture customers used by block/unblock and concurrent-edit tests.
  await db.user.upsert({
    where: { phone: fixtures.blockPhone },
    update: {},
    create: { role: "CUSTOMER", name: "QA Block Test", phone: fixtures.blockPhone },
  });
  // Dedicated customer for wrong/expired OTP tests, unique per run so the
  // per-phone OTP request limit is never hit across repeated runs.
  await db.user.upsert({
    where: { phone: fixtures.verifyPhone },
    update: {},
    create: { role: "CUSTOMER", name: "QA OTP Test", phone: fixtures.verifyPhone },
  });
  const editUser = await db.user.upsert({
    where: { phone: fixtures.editPhone },
    update: {},
    create: { role: "CUSTOMER", name: "QA Edit Test", phone: fixtures.editPhone },
  });
  await db.vehicle.upsert({
    where: { plate: fixtures.editPlate },
    update: {},
    create: {
      plate: fixtures.editPlate,
      make: "Test",
      model: "Edit",
      year: 2023,
      color: "Black",
      ownerId: editUser.id,
    },
  });

  // Guarantee the seeded first customer has fresh pending state for
  // customer dashboard tests, no matter how many runs came before.
  const seededCustomer = await db.user.findUnique({
    where: { phone: CUSTOMER_PHONE },
    select: { id: true },
  });
  const seededVehicle = await db.vehicle.findUnique({
    where: { plate: SEEDED_VEHICLE_PLATE },
    select: { id: true },
  });
  if (!seededCustomer || !seededVehicle) {
    throw new Error("Global setup: seeded customer or vehicle not found, run npm run seed");
  }
  // Drop leftovers from earlier runs so counts and lists stay deterministic.
  await db.contactRequest.deleteMany({ where: { scannerPhone: fixtures.qaScannerPhone } });
  await db.notification.deleteMany({ where: { title: { in: ["QA Unread", "QA Monitor"] } } });
  await db.subscriptionPlan.deleteMany({ where: { name: { startsWith: "QA Plan" } } });
  // Two pending requests: the admin and customer projects each approve
  // their own marker, so project order never consumes the other's row.
  await db.contactRequest.create({
    data: {
      vehicleId: seededVehicle.id,
      scannerName: "QA Scanner",
      scannerPhone: fixtures.qaScannerPhone,
      message: "QA pending request for admin approve",
      status: "PENDING",
    },
  });
  await db.contactRequest.create({
    data: {
      vehicleId: seededVehicle.id,
      scannerName: "QA Scanner",
      scannerPhone: fixtures.qaScannerPhone,
      message: "QA pending request for customer approve",
      status: "PENDING",
    },
  });
  await db.notification.createMany({
    data: [
      { userId: seededCustomer.id, title: "QA Unread", body: "QA unread notification for customer" },
      { userId: seededCustomer.id, title: "QA Monitor", body: "QA unread notification for admin monitoring" },
    ],
  });
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(".auth", { recursive: true });
  await loginAdmin();
  await loginCustomer();
  await seedFixtures();
  fs.writeFileSync(path.join(".auth", "fixtures.json"), JSON.stringify(fixtures, null, 2));
  await db.$disconnect();
}
