import { expect, test, type Locator, type Page } from "@playwright/test";
import { db } from "../src/lib/db";
import { fx } from "./fixtures";

function acceptConfirms(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

// Playwright has no toBeInvalid assertion, so check the browser's own
// constraint validation on the input instead.
async function expectInvalid(locator: Locator) {
  expect(await locator.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
}

// The admin project runs first and its mark-all-read action clears every
// unread notification globally, so restore the two customer notifications
// the notification tests rely on before this file's tests run.
test.beforeAll(async () => {
  const customer = await db.user.findFirst({ where: { name: "Ahmed Raza", role: "CUSTOMER" } });
  if (!customer) return;
  await db.notification.deleteMany({
    where: { userId: customer.id, title: { in: ["QA Unread", "QA Monitor"] } },
  });
  await db.notification.createMany({
    data: [
      {
        userId: customer.id,
        title: "QA Unread",
        body: "This notification must be cleared by mark all read.",
      },
      {
        userId: customer.id,
        title: "QA Monitor",
        body: "Admin monitoring notification for QA.",
      },
    ],
  });
});

const CUSTOMER_PAGES: { path: string; expectText: string }[] = [
  { path: "/customer", expectText: "Welcome back," },
  { path: "/customer/vehicle", expectText: "My vehicle" },
  { path: "/customer/qr", expectText: "My QR sticker" },
  { path: "/customer/orders", expectText: "My Sticker Orders" },
  { path: "/customer/notifications", expectText: "Notifications" },
  { path: "/customer/requests", expectText: "Contact requests" },
  { path: "/customer/emergency", expectText: "Emergency contact" },
];

test.describe("customer pages load", () => {
  for (const p of CUSTOMER_PAGES) {
    test(`${p.path} renders without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await page.goto(p.path);
      await expect(page.getByText(p.expectText).first()).toBeVisible();
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test("customer session on /admin lands on the customer dashboard", async ({ page }) => {
    // Same contract as the admin side: wrong role goes straight to the
    // visitor's own dashboard, never an error page or a login flash.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/customer$/);
  });
});

test.describe("customer data isolation", () => {
  test("no page shows another customer's vehicle, QR, or phone", async ({ page }) => {
    for (const p of CUSTOMER_PAGES) {
      await page.goto(p.path);
      const body = (await page.textContent("body")) || "";
      expect(body, `${p.path} leaked foreign plate`).not.toContain(fx.foreignPlate);
      expect(body, `${p.path} leaked foreign QR`).not.toContain("MPK-1002");
      expect(body, `${p.path} leaked foreign phone`).not.toContain(fx.foreignPhone);
      expect(body, `${p.path} leaked foreign name`).not.toContain(fx.foreignName);
    }
  });

  test("the dashboard shows the customer's own data", async ({ page }) => {
    await page.goto("/customer");
    await expect(page.getByText("Welcome back, Ahmed")).toBeVisible();
    await expect(page.getByText(fx.seededVehiclePlate).first()).toBeVisible();
    await expect(page.getByText("MPK-1001").first()).toBeVisible();
  });

  test("the orders page shows only this customer's orders", async ({ page }) => {
    await page.goto("/customer/orders");
    await expect(page.getByText("MPK-1001")).toBeVisible();
    await expect(page.getByText("MPK-1002")).toHaveCount(0);
  });
});

test.describe("customer vehicle form", () => {
  test("saving vehicle changes shows success and persists", async ({ page }) => {
    await page.goto("/customer/vehicle");
    const color = page.locator("#color");
    const original = (await color.inputValue()) || "White";
    await color.fill("QA Teal");
    await page.getByRole("button", { name: "Save vehicle" }).click();
    await expect(page.getByRole("status")).toContainText("Vehicle saved.");
    await page.reload();
    await expect(page.locator("#color")).toHaveValue("QA Teal");
    // Restore the seeded value.
    await page.locator("#color").fill(original);
    await page.getByRole("button", { name: "Save vehicle" }).click();
    await expect(page.getByRole("status")).toContainText("Vehicle saved.");
  });

  test("an invalid plate shows an inline error", async ({ page }) => {
    await page.goto("/customer/vehicle");
    await page.locator("#plate").fill("?? invalid");
    await page.getByRole("button", { name: "Save vehicle" }).click();
    // Scope to the form: Next's route announcer is also role="alert".
    await expect(page.locator("form").getByRole("alert")).toContainText(/valid plate/i);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("an invalid year is blocked by the form", async ({ page }) => {
    await page.goto("/customer/vehicle");
    await page.locator("#year").fill("1800");
    await expectInvalid(page.locator("#year"));
  });
});

test.describe("customer QR page", () => {
  test("shows the assigned QR image and copies the scan URL", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/customer/qr");
    await expect(page.getByRole("img", { name: "QR code MPK-1001" })).toBeVisible();
    await expect(page.getByText("Scan URL:").first()).toBeVisible();
    await page.getByRole("button", { name: "Copy scan URL" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  });
});

test.describe("customer requests and notifications", () => {
  test("approving a pending contact request shows success", async ({ page }) => {
    acceptConfirms(page);
    await page.goto("/customer/requests");
    const row = page.locator(".border", { hasText: "QA pending request for customer approve" }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status")).toContainText("Request approved.");
    await expect(row.getByText("Approved")).toBeVisible();
    await expect(row.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("mark all read clears every unread notification", async ({ page }) => {
    await page.goto("/customer/notifications");
    const button = page.getByRole("button", { name: /Mark all read/ });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole("status")).toContainText("All notifications marked read.");
    await expect(page.getByRole("button", { name: /Mark all read/ })).toHaveCount(0);
    // exact: the seeded title "QA Unread" contains the substring "Unread"
    // and would keep matching a non-exact lookup after the badges are gone.
    await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
  });
});

test.describe("customer emergency contact", () => {
  test("save, delete, and restore the emergency contact", async ({ page }) => {
    acceptConfirms(page);
    await page.goto("/customer/emergency");
    await page.locator("#ec-name").fill("QA Emergency");
    await page.locator("#ec-phone").fill("+92 300 5556667");
    await page.locator("#ec-rel").fill("Friend");
    await page.getByRole("button", { name: "Save emergency contact" }).click();
    await expect(page.getByRole("status")).toContainText("Emergency contact saved.");

    await page.getByRole("button", { name: "Remove emergency contact" }).click();
    await expect(page.getByRole("status")).toContainText("Emergency contact removed.");

    // Restore the seeded contact so screenshots and later runs look normal.
    await page.locator("#ec-name").fill("Sara Raza");
    await page.locator("#ec-phone").fill("+92 300 7654321");
    await page.locator("#ec-rel").fill("Wife");
    await page.getByRole("button", { name: "Save emergency contact" }).click();
    await expect(page.getByRole("status")).toContainText("Emergency contact saved.");
  });

  test("an invalid emergency phone shows an inline error", async ({ page }) => {
    await page.goto("/customer/emergency");
    await page.locator("#ec-phone").fill("12");
    await page.getByRole("button", { name: "Save emergency contact" }).click();
    // Scope to the form: Next's route announcer is also role="alert".
    await expect(page.locator("form").getByRole("alert")).toContainText(/valid pakistani mobile/i);
  });
});

test.describe("customer logout", () => {
  test("logging out returns to the login page", async ({ page }) => {
    await page.goto("/customer");
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Send OTP" })).toBeVisible();
  });
});
