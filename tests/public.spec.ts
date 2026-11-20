import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db";
import { fx } from "./fixtures";

// Matches a full Pakistani mobile number in compact or spaced form, for
// example +923001234567, +92 300 1234567, or 92-300-1234567. Masked numbers
// with bullet characters never match because the last group needs 7 digits.
const FULL_PHONE_PATTERN = /\+?92[\s-]?\d{3}[\s-]?\d{7}/;

function expectNoFullPhone(body: string, label: string) {
  expect(body, `${label} leaked a full phone number`).not.toMatch(FULL_PHONE_PATTERN);
}

test.describe("route guards", () => {
  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?role=admin/);
    await expect(page.getByRole("heading", { name: "Login to M-Park" })).toBeVisible();
  });

  test("unauthenticated /customer redirects to /login", async ({ page }) => {
    await page.goto("/customer");
    await expect(page).toHaveURL(/\/login\?role=customer/);
    await expect(page.getByRole("heading", { name: "Login to M-Park" })).toBeVisible();
  });

  test("root / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/$/);
  });
});

test.describe("admin login API", () => {
  test("wrong password is rejected with an inline friendly error", async ({ request }) => {
    const res = await request.post("/api/auth/admin-login", {
      data: { email: "admin@m-park.example", password: "not-the-password" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // The app message is "Wrong email or password."; this test originally
    // expected "invalid email or password", which never matched.
    expect(body.error).toMatch(/wrong email or password/i);
  });

  test("empty body is rejected with 400", async ({ request }) => {
    const res = await request.post("/api/auth/admin-login", { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
  });

  test("correct credentials return a session", async ({ request }) => {
    const res = await request.post("/api/auth/admin-login", {
      data: { email: "admin@m-park.example", password: "Admin1234!" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("brute force attempts are rate limited with 429", async ({ request }) => {
    let sawRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await request.post("/api/auth/admin-login", {
        data: { email: `brute.force.${fx.runSuffix}@test.local`, password: "wrong" },
      });
      if (res.status() === 429) {
        sawRateLimit = true;
        const body = await res.json();
        expect(body.error).toMatch(/too many/i);
        break;
      }
      expect(res.status()).toBe(401);
    }
    expect(sawRateLimit, "rate limit never triggered for admin login").toBe(true);
  });
});

test.describe("admin login UI", () => {
  test("wrong password shows an inline error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Admin" }).click();
    await page.locator("#admin-email").fill("admin@m-park.example");
    await page.locator("#admin-password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Login as admin" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("correct credentials navigate to the admin dashboard", async ({ page }) => {
    await page.goto("/login?role=admin");
    await page.locator("#admin-email").fill("admin@m-park.example");
    await page.locator("#admin-password").fill("Admin1234!");
    await page.getByRole("button", { name: "Login as admin" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("customer OTP flow", () => {
  test("otp request rejects an invalid phone with 400", async ({ request }) => {
    const res = await request.post("/api/otp/request", { data: { phone: "12345" } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid pakistani mobile/i);
  });

  test("otp request rejects an empty body with 400", async ({ request }) => {
    const res = await request.post("/api/otp/request", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("otp request returns 404 for an unknown phone", async ({ request }) => {
    const res = await request.post("/api/otp/request", {
      data: { phone: `+92309${fx.runSuffix.slice(-7)}` },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no customer account/i);
  });

  test("otp verify returns 404 for an unknown phone", async ({ request }) => {
    const res = await request.post("/api/otp/verify-customer", {
      data: { phone: `+92308${fx.runSuffix.slice(-7)}`, code: "123456" },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no customer account/i);
  });

  test("otp verify returns 404 for an admin phone", async ({ request }) => {
    const res = await request.post("/api/otp/verify-customer", {
      data: { phone: "+92 300 0000000", code: "123456" },
    });
    expect(res.status()).toBe(404);
  });

  test("wrong OTP code is rejected with 401", async ({ request }) => {
    const otpRes = await request.post("/api/otp/request", {
      data: { phone: fx.verifyPhone, purpose: "login" },
    });
    expect(otpRes.ok()).toBe(true);
    const res = await request.post("/api/otp/verify-customer", {
      data: { phone: fx.verifyPhone, code: "000000" },
    });
    // A wrong OTP is an authentication failure, so 401 is the correct status.
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/wrong otp/i);
  });

  test("expired OTP code is rejected with 401", async ({ request }) => {
    const otpRes = await request.post("/api/otp/request", {
      data: { phone: fx.verifyPhone, purpose: "login" },
    });
    expect(otpRes.ok()).toBe(true);
    await db.otpCode.updateMany({
      where: { phone: fx.verifyPhone, purpose: "login", verified: false },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const { devCode } = (await otpRes.json()) as { devCode: string };
    const res = await request.post("/api/otp/verify-customer", {
      data: { phone: fx.verifyPhone, code: devCode },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  test("otp request rate limit returns 429", async ({ request }) => {
    const phone = `+92307${fx.runSuffix.slice(-7)}`;
    let sawRateLimit = false;
    for (let i = 0; i < 7; i++) {
      const res = await request.post("/api/otp/request", { data: { phone, purpose: "login" } });
      if (res.status() === 429) {
        sawRateLimit = true;
        const body = await res.json();
        expect(body.error).toMatch(/too many/i);
        break;
      }
    }
    expect(sawRateLimit, "rate limit never triggered for otp request").toBe(true);
  });
});

test.describe("order validation", () => {
  test("empty body is rejected with 400", async ({ request }) => {
    const res = await request.post("/api/order", { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("invalid phone is rejected with 400", async ({ request }) => {
    const res = await request.post("/api/order", {
      data: { buyerName: "QA Buyer", buyerPhone: "not-a-phone", deliveryAddress: "Street 1" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid pakistani mobile/i);
  });

  test("invalid plate is rejected with 400", async ({ request }) => {
    const res = await request.post("/api/order", {
      data: {
        buyerName: "QA Buyer",
        buyerPhone: "+92 300 1234567",
        deliveryAddress: "Street 1",
        plate: "!!",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/plate/i);
  });
});

test.describe("register validation", () => {
  async function registerBody(overrides: Record<string, unknown> = {}) {
    const plan = await db.subscriptionPlan.findFirst({
      where: { isActive: true },
      orderBy: { pricePkr: "asc" },
      select: { id: true },
    });
    if (!plan) throw new Error("No active subscription plan seeded");
    return {
      code: fx.freeCodes[0],
      name: "QA Customer",
      phone: fx.registerPhone,
      plate: fx.registerPlate,
      make: "Toyota",
      model: "Corolla",
      color: "Silver",
      year: 2024,
      planId: plan.id,
      otp: "123456",
      ...overrides,
    };
  }

  test("empty body is rejected with 400", async ({ request }) => {
    const res = await request.post("/api/register", { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("invalid year is rejected with 400", async ({ request }) => {
    const body = await registerBody({ year: 1800, code: fx.freeCodes[1] });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/year/i);
  });

  test("invalid plate is rejected with 400", async ({ request }) => {
    const body = await registerBody({ plate: "??", code: fx.freeCodes[2] });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/plate/i);
  });

  test("duplicate phone is rejected with 409", async ({ request }) => {
    const body = await registerBody({ phone: fx.seededCustomerPhone, code: fx.freeCodes[1] });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/already/i);
  });

  test("duplicate plate is rejected with 409", async ({ request }) => {
    const body = await registerBody({ plate: fx.seededVehiclePlate, code: fx.freeCodes[2] });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/already registered/i);
  });

  test("unknown QR code is rejected with 404", async ({ request }) => {
    const body = await registerBody({ code: `MPK-0${fx.runSuffix}` });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });

  test("already assigned QR code is rejected with 409", async ({ request }) => {
    const body = await registerBody({ code: "MPK-1001" });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/already/i);
  });

  test("lost QR code cannot be re-registered", async ({ request }) => {
    const body = await registerBody({ code: fx.lostCode });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/lost/i);
  });

  test("valid registration creates the customer and vehicle", async ({ request }) => {
    const otpRes = await request.post("/api/otp/request", {
      data: { phone: fx.registerPhone, purpose: "register" },
    });
    expect(otpRes.ok()).toBe(true);
    const { devCode } = (await otpRes.json()) as { devCode: string };
    const body = await registerBody({ otp: devCode });
    const res = await request.post("/api/register", { data: body });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    const user = await db.user.findUnique({
      where: { phone: fx.registerPhone },
      include: { vehicles: true },
    });
    expect(user).not.toBeNull();
    expect(user!.vehicles.map((v) => v.plate)).toContain(fx.registerPlate);
    const qr = await db.qrCode.findUnique({ where: { code: fx.freeCodes[0] } });
    expect(qr?.vehicleId).toBe(user!.vehicles[0].id);
  });
});

test.describe("public APIs never leak owner phone", () => {
  test("GET /api/qr/[code] returns vehicle data without any phone number", async ({ request }) => {
    const res = await request.get("/api/qr/MPK-1001");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expectNoFullPhone(text, "GET /api/qr/MPK-1001");
    expect(text).not.toContain("+92 300 1234567");
  });

  test("GET /api/qr/[code] returns 404 for an unknown code", async ({ request }) => {
    const res = await request.get(`/api/qr/MPK-0${fx.runSuffix}`);
    expect(res.status()).toBe(404);
  });

  test("POST /api/scan/[code]/call masks the owner phone", async ({ request }) => {
    const res = await request.post(`/api/scan/${fx.rateQr}/call`);
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expectNoFullPhone(text, "scan call response");
    expect(text).not.toContain(fx.ratePhone);
    expect(text).toMatch(/maskedNumber/);
    // The mask must be derived from the real owner phone (mobile prefix 303),
    // not a hard-coded constant.
    expect(text, "masked number does not derive from the owner phone").toContain("303");
  });

  test("POST /api/scan/[code]/alert works and never echoes a phone", async ({ request }) => {
    const res = await request.post(`/api/scan/${fx.rateQr}/alert`, {
      data: { message: "QA alert message" },
    });
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expectNoFullPhone(text, "scan alert response");
  });
});

test.describe("scan alert rate limit", () => {
  test("alerts for the same QR are rate limited with 429", async ({ request }) => {
    let sawRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await request.post(`/api/scan/${fx.rateQr}/alert`, {
        data: { message: `QA burst ${i}` },
      });
      if (res.status() === 429) {
        sawRateLimit = true;
        const body = await res.json();
        expect(body.error).toMatch(/too many/i);
        break;
      }
      expect(res.ok()).toBe(true);
    }
    expect(sawRateLimit, "rate limit never triggered for scan alerts").toBe(true);
  });
});
