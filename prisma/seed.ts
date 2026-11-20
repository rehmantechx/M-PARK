// Seed script. This is TEST data only, for local development and for the
// client to see the flows working. It is not hardcoded in the UI.
// Real customers, vehicles and QR codes entered after seeding are stored
// in the database and are not touched by this script unless it is re-run,
// which wipes and reseeds. Do not run seed on a live database.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const customers = [
  { name: "Ahmed Raza", phone: "+92 300 1234567", plate: "LEA-24-1234", make: "Toyota", model: "Corolla", year: 2022, color: "White", code: "MPK-1001", plan: "Basic Monthly", emergency: { name: "Sara Raza", phone: "+92 300 7654321", relationship: "Wife" } },
  { name: "Ayesha Khan", phone: "+92 321 7654321", plate: "ISB-22-5678", make: "Honda", model: "Civic", year: 2021, color: "Black", code: "MPK-1002", plan: "Premium Yearly", emergency: { name: "Omar Khan", phone: "+92 321 1112233", relationship: "Brother" } },
  { name: "Bilal Ahmed", phone: "+92 333 9876543", plate: "LHR-23-9012", make: "Suzuki", model: "Alto", year: 2023, color: "Silver", code: "MPK-1003", plan: "Standard Monthly", emergency: { name: "Hassan Ahmed", phone: "+92 333 2223344", relationship: "Father" } },
  { name: "Fatima Malik", phone: "+92 345 1122334", plate: "KHI-21-3456", make: "Toyota", model: "Yaris", year: 2020, color: "Grey", code: "MPK-1004", plan: "Basic Monthly", emergency: { name: "Ali Malik", phone: "+92 345 9988776", relationship: "Husband" } },
  { name: "Usman Tariq", phone: "+92 301 5566778", plate: "RWP-24-7890", make: "Honda", model: "City", year: 2022, color: "Blue", code: "MPK-1005", plan: "Basic Monthly", emergency: { name: "Zain Tariq", phone: "+92 301 4433221", relationship: "Brother" } },
  { name: "Sana Iqbal", phone: "+92 312 9988776", plate: "LEA-23-1122", make: "Suzuki", model: "Swift", year: 2021, color: "Red", code: "MPK-1006", plan: "Premium Yearly", emergency: { name: "Nida Iqbal", phone: "+92 312 6655443", relationship: "Sister" } },
  { name: "Hassan Ali", phone: "+92 344 3344556", plate: "ISB-24-6677", make: "Kia", model: "Sportage", year: 2023, color: "White", code: "MPK-1007", plan: "Basic Monthly", emergency: { name: "Amina Ali", phone: "+92 344 7788990", relationship: "Mother" } },
  { name: "Maryam Siddiqui", phone: "+92 300 6677889", plate: "LHR-22-3344", make: "Toyota", model: "Fortuner", year: 2022, color: "Black", code: "MPK-1008", plan: "Premium Yearly", emergency: { name: "Bilal Siddiqui", phone: "+92 300 1122334", relationship: "Husband" } },
  // Vehicle from the client reference video: LEK 7982, Grey Suzuki Cultus.
  // Test owner name only, from the video TikTok handle, replace with the real owner when confirmed.
  { name: "Mudassir Ahmed", phone: "+92 300 1112233", plate: "LEK 7982", make: "Suzuki", model: "Cultus", year: 2021, color: "Grey", code: "MPK-1009", plan: "Basic Monthly", emergency: { name: "Ayesha Ahmed", phone: "+92 300 4445566", relationship: "Wife" } },
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed must never run on a live database.");
  await db.scanLog.deleteMany();
  await db.contactRequest.deleteMany();
  await db.notification.deleteMany();
  await db.otpCode.deleteMany();
  await db.subscription.deleteMany();
  await db.stickerOrder.deleteMany();
  await db.qrCode.deleteMany();
  await db.vehicle.deleteMany();
  await db.emergencyContact.deleteMany();
  await db.user.deleteMany();
  await db.subscriptionPlan.deleteMany();
  await db.product.deleteMany();

  const adminHash = await bcrypt.hash("Admin1234!", 10);
  await db.user.create({
    data: { role: "ADMIN", name: "M-Park Owner", phone: "+92 300 0000000", email: "admin@m-park.example", passwordHash: adminHash },
  });

  const basic = await db.subscriptionPlan.create({ data: { name: "Basic Monthly", pricePkr: 499, durationMonths: 1, description: "One vehicle, one QR sticker, call and text contact." } });
  const standard = await db.subscriptionPlan.create({ data: { name: "Standard Monthly", pricePkr: 999, durationMonths: 1, description: "One vehicle, priority contact requests, emergency contact." } });
  const premium = await db.subscriptionPlan.create({ data: { name: "Premium Yearly", pricePkr: 9999, durationMonths: 12, description: "One vehicle for 12 months, all contact options, full history." } });
  const plans: Record<string, { id: string; durationMonths: number }> = {
    "Basic Monthly": basic,
    "Standard Monthly": standard,
    "Premium Yearly": premium,
  };

  for (const c of customers) {
    const plan = plans[c.plan];
    const isExpired = c.name === "Fatima Malik";
    const isBlocked = c.name === "Hassan Ali";
    const user = await db.user.create({ data: { role: "CUSTOMER", name: c.name, phone: c.phone, isBlocked } });
    await db.vehicle.create({ data: { plate: c.plate, make: c.make, model: c.model, year: c.year, color: c.color, ownerId: user.id } });
    const start = new Date("2026-11-10T00:00:00Z");
    const end = new Date(start);
    end.setMonth(end.getMonth() + plan.durationMonths);
    if (isExpired) { start.setMonth(start.getMonth() - 2); end.setMonth(end.getMonth() - 2); }
    await db.subscription.create({ data: { userId: user.id, planId: plan.id, startDate: start, endDate: end, status: isExpired ? "EXPIRED" : "ACTIVE" } });
    await db.emergencyContact.create({ data: { userId: user.id, name: c.emergency.name, phone: c.emergency.phone, relationship: c.emergency.relationship } });
    await db.notification.create({ data: { userId: user.id, title: "Welcome to M-Park", body: `Your QR sticker ${c.code} is active for ${c.plate}.` } });
  }

  // QR inventory: batch B-001, MPK-1001 to MPK-1050, first 9 assigned.
  const vehicles = await db.vehicle.findMany({ orderBy: { plate: "asc" } });
  const vehicleByCode: Record<string, string> = {};
  customers.forEach((c) => {
    const v = vehicles.find((x) => x.plate === c.plate);
    if (v) vehicleByCode[c.code] = v.id;
  });
  for (let n = 1001; n <= 1050; n++) {
    const code = `MPK-${n}`;
    const vid = vehicleByCode[code];
    await db.qrCode.create({
      data: { code, batch: "B-001", status: code === "MPK-1007" ? "LOST" : code === "MPK-1004" ? "INACTIVE" : "ACTIVE", vehicleId: vid || null, assignedAt: vid ? new Date("2026-11-10T00:00:00Z") : null },
    });
  }
  for (let n = 1051; n <= 1100; n++) {
    await db.qrCode.create({ data: { code: `MPK-${n}`, batch: "B-002", status: "ACTIVE", vehicleId: null } });
  }

  // The product being sold: the M-Park QR sticker. The price lives in
  // the database and is managed in the Admin Dashboard.
  const sticker = await db.product.create({ data: { name: "M-Park QR Sticker", pricePkr: 999, description: "Round blue QR sticker for the car windscreen. Permanently linked to one vehicle after registration." } });

  // Sample sticker sales, linked to real seeded customers and QR codes.
  const ahmedUserSeed = await db.user.findFirst({ where: { phone: "+92 300 1234567" } });
  const ayeshaUserSeed = await db.user.findFirst({ where: { phone: "+92 321 7654321" } });
  const qr1001 = await db.qrCode.findUnique({ where: { code: "MPK-1001" } });
  const qr1002 = await db.qrCode.findUnique({ where: { code: "MPK-1002" } });
  const ahmedVehicleSeed = vehicles.find((v) => v.plate === "LEA-24-1234");
  const ayeshaVehicleSeed = vehicles.find((v) => v.plate === "ISB-22-5678");
  if (ahmedUserSeed && qr1001 && ahmedVehicleSeed) {
    await db.stickerOrder.create({ data: { buyerName: "Ahmed Raza", buyerPhone: "+92 300 1234567", deliveryAddress: "Lahore", plate: "LEA-24-1234", stickerCode: "MPK-1001", pricePkr: sticker.pricePkr, paymentStatus: "PAID", paymentMethod: "JazzCash", orderStatus: "ACTIVATED", userId: ahmedUserSeed.id, vehicleId: ahmedVehicleSeed.id, qrCodeId: qr1001.id } });
  }
  if (ayeshaUserSeed && qr1002 && ayeshaVehicleSeed) {
    await db.stickerOrder.create({ data: { buyerName: "Ayesha Khan", buyerPhone: "+92 321 7654321", deliveryAddress: "Islamabad", plate: "ISB-22-5678", stickerCode: "MPK-1002", pricePkr: sticker.pricePkr, paymentStatus: "PAID", paymentMethod: "Easypaisa", orderStatus: "DELIVERED", userId: ayeshaUserSeed.id, vehicleId: ayeshaVehicleSeed.id, qrCodeId: qr1002.id } });
  }

  // Sample contact requests and scans, linked to real seeded vehicles.
  const ahmedVehicle = vehicles.find((v) => v.plate === "LEA-24-1234");
  const ayeshaVehicle = vehicles.find((v) => v.plate === "ISB-22-5678");
  const ahmedUser = await db.user.findFirst({ where: { phone: "+92 300 1234567" } });
  if (ahmedVehicle && ahmedUser) {
    await db.contactRequest.create({ data: { vehicleId: ahmedVehicle.id, scannerName: "Ali Nawaz", scannerPhone: "+92 300 9988776", message: "Your car is blocking my driveway, please move it.", status: "PENDING" } });
    await db.scanLog.create({ data: { vehicleId: ahmedVehicle.id, scannerName: "Ali Nawaz", scannerPhone: "+92 300 9988776", verified: true } });
    await db.notification.create({ data: { userId: ahmedUser.id, title: "New contact request", body: "Ali Nawaz scanned your car LEA-24-1234 and asked you to move it." } });
  }
  if (ayeshaVehicle) {
    await db.contactRequest.create({ data: { vehicleId: ayeshaVehicle.id, scannerName: "Zainab Hussain", scannerPhone: "+92 321 4455667", message: "Your car lights are on.", status: "PENDING" } });
    await db.scanLog.create({ data: { vehicleId: ayeshaVehicle.id, scannerName: "Zainab Hussain", scannerPhone: "+92 321 4455667", verified: true } });
  }

  console.log("Seed done. 9 customers, 9 vehicles, 100 QR codes in 2 batches, 3 plans, 1 sticker product, 2 sticker orders. Change the seeded admin password before launch.");
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
