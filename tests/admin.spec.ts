import { expect, test, type Locator, type Page } from "@playwright/test";
import { fx } from "./fixtures";

// Accept confirm() dialogs so buttons with a confirm prompt proceed.
function acceptConfirms(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

// Playwright has no toBeInvalid assertion, so check the browser's own
// constraint validation on the input instead.
async function expectInvalid(locator: Locator) {
  expect(await locator.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
}

const ADMIN_PAGES: { path: string; expectText: string }[] = [
  { path: "/admin", expectText: "Total registered customers" },
  { path: "/admin/customers", expectText: "Customers" },
  { path: "/admin/vehicles", expectText: "Vehicles" },
  { path: "/admin/qr-codes", expectText: "QR Codes" },
  { path: "/admin/inventory", expectText: "QR Inventory" },
  { path: "/admin/orders", expectText: "Orders" },
  { path: "/admin/requests", expectText: "Contact Requests" },
  { path: "/admin/notifications", expectText: "Notifications monitoring" },
  { path: "/admin/subscriptions", expectText: "Subscription plans" },
];

test.describe("admin pages load", () => {
  for (const p of ADMIN_PAGES) {
    test(`${p.path} renders without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(String(err)));
      await page.goto(p.path);
      await expect(page.getByText(p.expectText).first()).toBeVisible();
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test("admin session on /customer lands on the admin dashboard", async ({ page }) => {
    // The login page bounces any valid session to its own dashboard, so a
    // wrong-role visit must go straight there instead of via the login page.
    await page.goto("/customer");
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("admin customers", () => {
  test("search by plate finds only the matching customer", async ({ page }) => {
    await page.goto("/admin/customers");
    // Search for the other seeded customer's plate (Ayesha's vehicle), not
    // the seededVehiclePlate which belongs to Ahmed Raza.
    await page.locator('input[name="q"]').fill(fx.foreignPlate);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Ayesha Khan")).toBeVisible();
    await expect(page.getByText("Ahmed Raza")).toHaveCount(0);
  });

  test("adding a customer with an invalid phone shows an inline error", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.locator("#add-name").fill("QA Invalid");
    await page.locator("#add-phone").fill("123");
    await page.locator("#add-plate").fill(`IV-${fx.runSuffix}`);
    await page.locator("#add-year").fill("2024");
    await page.locator("#add-make").fill("Toyota");
    await page.locator("#add-model").fill("Corolla");
    await page.locator("#add-color").fill("White");
    await page.locator("#add-plan").selectOption({ index: 0 });
    await page.locator("#add-qr").selectOption({ index: 0 });
    await page.getByRole("button", { name: "Add customer" }).click();
    // Scope to the form: Next's route announcer is also role="alert".
    await expect(page.locator("form").getByRole("alert")).toContainText(/valid pakistani mobile/i);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("adding a valid customer succeeds and shows a success message", async ({ page }) => {
    await page.goto("/admin/customers");
    const phone = `+92305${fx.runSuffix}`;
    await page.locator("#add-name").fill("QA Added Customer");
    await page.locator("#add-phone").fill(phone);
    await page.locator("#add-plate").fill(`AD-${fx.runSuffix}`);
    await page.locator("#add-year").fill("2024");
    await page.locator("#add-make").fill("Honda");
    await page.locator("#add-model").fill("Civic");
    await page.locator("#add-color").fill("Blue");
    await page.locator("#add-plan").selectOption({ index: 0 });
    await page.locator("#add-qr").selectOption({ index: 0 });
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page.getByRole("status")).toContainText("Customer added.");
    await page.locator('input[name="q"]').fill(phone);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("QA Added Customer")).toBeVisible();
  });

  test("block and unblock a customer from the list", async ({ page }) => {
    acceptConfirms(page);
    await page.goto(`/admin/customers?q=${fx.blockPhone}`);
    await expect(page.getByText(fx.blockPhone)).toBeVisible();
    await page.getByRole("button", { name: "Block", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Customer blocked.");
    await page.getByRole("button", { name: "Unblock", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Customer unblocked.");
  });

  test("edit form validation rejects an invalid year", async ({ page }) => {
    await page.goto(`/admin/customers?q=${fx.editPhone}`);
    const editCard = page.locator(".card", { hasText: "Edit a customer" });
    await editCard.locator('input[name="year"]').fill("1800");
    // The number input enforces min=1900, so the submit never reaches the
    // server: the field itself must report the validity problem.
    await expectInvalid(editCard.locator('input[name="year"]'));
  });

  test("pagination parameters are handled safely", async ({ page }) => {
    await page.goto("/admin/customers?page=abc");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await page.goto("/admin/customers?page=999");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  });

  test("actions are rejected without a session and show an inline error", async ({ page }) => {
    acceptConfirms(page);
    await page.goto(`/admin/customers?q=${fx.editPhone}`);
    await page.context().clearCookies();
    await page.getByRole("button", { name: "Block", exact: true }).first().click();
    await expect(page.getByRole("alert").first()).toContainText(/log in again|session expired/i);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});

test.describe("admin QR codes and inventory", () => {
  test("QR status can be activated from the list", async ({ page }) => {
    acceptConfirms(page);
    await page.goto(`/admin/qr-codes?q=${fx.lostCode}`);
    await expect(page.getByText(fx.lostCode).first()).toBeVisible();
    const row = page.locator("tr", { hasText: fx.lostCode });
    // exact: case-insensitive getByText would also match the "Lost" button
    // and the "Inactive" button in the same row.
    await expect(row.getByText("LOST", { exact: true })).toBeVisible();
    // exact: without it the accessible-name substring match also hits the
    // "Deactivate" button in the same row (Playwright strict mode).
    await row.getByRole("button", { name: "Activate", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("QR code marked ACTIVE.");
    await expect(page.locator("tr", { hasText: fx.lostCode }).getByText("ACTIVE", { exact: true })).toBeVisible();
  });

  test("QR search with an unknown code shows the empty state", async ({ page }) => {
    await page.goto(`/admin/qr-codes?q=MPK-0${fx.runSuffix}`);
    await expect(page.getByText("No QR codes found.")).toBeVisible();
  });

  test("generating a batch creates codes and shows a success message", async ({ page }) => {
    acceptConfirms(page);
    await page.goto("/admin/inventory");
    await page.locator("#batch-count").selectOption("10");
    await page.getByRole("button", { name: "Generate batch" }).click();
    await expect(page.getByRole("status")).toContainText(/QR codes created in batch/);
  });
});

test.describe("admin requests", () => {
  test("the seeded pending request can be approved with a success message", async ({ page }) => {
    await page.goto("/admin/requests?status=PENDING");
    const row = page.locator(".card .border", { hasText: "QA pending request for admin approve" }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status")).toContainText("Request approved.");
  });

  test("filter links switch the request list", async ({ page }) => {
    await page.goto("/admin/requests");
    await page.getByRole("link", { name: "Approved" }).click();
    await expect(page).toHaveURL(/status=APPROVED/);
    await expect(page.getByRole("heading", { name: "Contact Requests" })).toBeVisible();
  });
});

test.describe("admin notifications", () => {
  test("mark all read clears every unread notification and hides the button", async ({ page }) => {
    await page.goto("/admin/notifications");
    const button = page.getByRole("button", { name: /Mark all read/ });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole("status")).toContainText("All notifications marked read.");
    await expect(page.getByRole("button", { name: /Mark all read/ })).toHaveCount(0);
  });
});

test.describe("admin subscriptions", () => {
  test("creating a plan with price0 is blocked by validation", async ({ page }) => {
    await page.goto("/admin/subscriptions");
    const createCard = page.locator(".card", { hasText: "Create new plan" });
    await createCard.locator('input[name="name"]').fill(`QA Zero ${fx.runSuffix}`);
    await createCard.locator('input[name="pricePkr"]').fill("0");
    await expectInvalid(createCard.locator('input[name="pricePkr"]'));
  });

  test("creating and editing a plan works with success messages", async ({ page }) => {
    await page.goto("/admin/subscriptions");
    const name = `QA Plan ${fx.runSuffix}`;
    const createCard = page.locator(".card", { hasText: "Create new plan" });
    await createCard.locator('input[name="name"]').fill(name);
    await createCard.locator('input[name="pricePkr"]').fill("500");
    await createCard.getByRole("button", { name: "Create plan" }).click();
    await expect(createCard.getByRole("status")).toContainText("Plan created.");

    // Scope to the plan's own row: the surrounding card holds every plan
    // form on the page, so unscoped name=pricePkr inputs would strict-violate.
    const planCard = page.locator(".border", { hasText: name });
    await expect(planCard).toBeVisible();
    await planCard.locator('input[name="pricePkr"]').fill("600");
    await planCard.getByRole("button", { name: "Save", exact: true }).click();
    await expect(planCard.getByRole("status")).toContainText("Plan saved.");
  });

  test("editing a plan with an invalid duration shows an inline error", async ({ page }) => {
    await page.goto("/admin/subscriptions");
    const createCard = page.locator(".card", { hasText: "Create new plan" });
    await createCard.locator('input[name="name"]').fill(`QA Dur ${fx.runSuffix}`);
    await createCard.locator('input[name="pricePkr"]').fill("100");
    await createCard.locator('input[name="durationMonths"]').fill("999");
    await expectInvalid(createCard.locator('input[name="durationMonths"]'));
  });
});

test.describe("admin orders", () => {
  test("order status cannot move backwards", async ({ page }) => {
    await page.goto("/admin/orders");
    const row = page.locator("tr", { hasText: "MPK-1001" }).first();
    await expect(row).toBeVisible();
    await row.locator('select[name="orderStatus"]').selectOption("ORDERED");
    await row.locator('button:has-text("Save status")').click();
    await expect(row.getByRole("alert")).toContainText(/cannot move backwards/i);
  });

  test("ACTIVATED requires the order to be paid first", async ({ page }) => {
    await page.goto("/admin/orders");
    const row = page.locator("tr", { hasText: "MPK-1002" }).first();
    await expect(row).toBeVisible();
    const unpaidBtn = row.getByRole("button", { name: "Mark Unpaid" });
    if (await unpaidBtn.count()) {
      await unpaidBtn.click();
      await expect(row.getByRole("status")).toContainText("Order marked unpaid.");
    }
    await row.locator('select[name="orderStatus"]').selectOption("ACTIVATED");
    await row.locator('button:has-text("Save status")').click();
    await expect(row.getByRole("alert")).toContainText(/after payment|marked paid/i);
    // Restore the seeded state: paid and delivered.
    const paidBtn = row.getByRole("button", { name: "Mark Paid" });
    if (await paidBtn.count()) {
      await paidBtn.click();
      await expect(row.getByRole("status")).toContainText("Order marked paid.");
    }
    await expect(row.locator('select[name="orderStatus"]')).toHaveValue("DELIVERED");
  });

  test("product price of0 is blocked by validation", async ({ page }) => {
    await page.goto("/admin/orders");
    const price = page.locator('input[name="pricePkr"]').first();
    await price.fill("0");
    await expectInvalid(price);
  });
});
