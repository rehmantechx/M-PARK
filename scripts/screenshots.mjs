// Captures every dashboard page at desktop and mobile widths into screenshots/.
// Run with the dev server up: node scripts/screenshots.mjs
// Requires .auth/admin.json and .auth/customer.json (created by the Playwright
// global setup, so run `npx playwright test --project=public` first if missing).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("screenshots");

const ADMIN_PAGES = [
  "/admin",
  "/admin/customers",
  "/admin/vehicles",
  "/admin/qr-codes",
  "/admin/inventory",
  "/admin/orders",
  "/admin/requests",
  "/admin/notifications",
  "/admin/subscriptions",
];
const CUSTOMER_PAGES = [
  "/customer",
  "/customer/vehicle",
  "/customer/qr",
  "/customer/orders",
  "/customer/notifications",
  "/customer/requests",
  "/customer/emergency",
];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const slug = (p) => p.replace(/^\//, "").replace(/\//g, "-");

async function shootGroup(browser, prefix, pages, stateFile) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      storageState: stateFile,
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    for (const p of pages) {
      await page.goto(BASE + p, { waitUntil: "load", timeout: 45000 });
      await page.waitForSelector("main", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      const file = path.join(OUT, `${prefix}-${slug(p)}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${path.basename(file)}`);
      if (errors.length) {
        console.error(`pageerror on ${p}: ${errors.join(" | ")}`);
        errors.length = 0;
      }
    }
    await ctx.close();
  }
}

for (const f of [".auth/admin.json", ".auth/customer.json"]) {
  if (!fs.existsSync(f)) {
    console.error(`missing ${f}, run: npx playwright test --project=public`);
    process.exit(1);
  }
}
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
await shootGroup(browser, "admin", ADMIN_PAGES, ".auth/admin.json");
await shootGroup(browser, "customer", CUSTOMER_PAGES, ".auth/customer.json");
await browser.close();
console.log("done");
