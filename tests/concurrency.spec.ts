import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db";
import { fx } from "./fixtures";

test.describe("concurrent orders", () => {
  test("parallel orders for free inventory never create duplicate stickers", async ({ request }) => {
    const buyerName = `QA Concurrency ${fx.runSuffix}`;
    const buyerPhone = `+92 309 ${fx.runSuffix.slice(0, 7).padEnd(7, "0")}`;
    const posts = Array.from({ length: 8 }, () =>
      request.post("/api/order", {
        data: {
          buyerName,
          buyerPhone,
          deliveryAddress: "QA concurrency lane, Lahore",
        },
      }),
    );
    const responses = await Promise.all(posts);
    const codes: string[] = [];
    for (const res of responses) {
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { ok: boolean; stickerCode?: string };
      expect(body.ok).toBe(true);
      expect(body.stickerCode).toBeTruthy();
      codes.push(body.stickerCode as string);
    }
    // Every concurrent order must hold a different physical sticker code.
    expect(new Set(codes).size).toBe(8);

    const rows = await db.stickerOrder.findMany({
      where: { buyerName },
      select: { stickerCode: true },
    });
    expect(rows.length).toBe(8);
    expect(new Set(rows.map((r) => r.stickerCode)).size).toBe(8);

    // No two non-cancelled orders anywhere may share a paid QR reservation.
    const dupes = await db.$queryRaw<{ code: string; n: bigint }[]>`
      SELECT "stickerCode" as code, COUNT(*) as n
      FROM "StickerOrder"
      WHERE "paymentStatus" = 'PAID' AND "orderStatus" IN ('ACTIVATED', 'DELIVERED')
      GROUP BY "stickerCode" HAVING COUNT(*) > 1`;
    expect(dupes.length).toBe(0);
    await db.$disconnect();
  });
});

test.describe("concurrent admin edits", () => {
  test("a stale edit cannot silently overwrite a newer save", async ({ browser }) => {
    // Context A loads the edit form first (stale snapshot of updatedAt).
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      await pageA.goto(`/admin/customers?q=${fx.editPhone}`);
      await pageA.getByRole("link", { name: "Edit", exact: true }).first().click();
      await expect(pageA).toHaveURL(/edit=/);

      // Context B edits and saves first, changing the color.
      await pageB.goto(`/admin/customers?q=${fx.editPhone}`);
      await pageB.getByRole("link", { name: "Edit", exact: true }).first().click();
      const formB = pageB.locator(".card", { hasText: "Edit a customer" });
      await formB.locator('input[name="color"]').fill("QA B Color");
      await formB.getByRole("button", { name: "Save customer" }).click();
      await expect(formB.getByRole("status")).toContainText("Customer saved.");

      // Context A still holds the stale form (old name, old color) and saves.
      const formA = pageA.locator(".card", { hasText: "Edit a customer" });
      await formA.locator('input[name="name"]').fill("QA A Stale Name");
      await formA.locator('input[name="color"]').fill("QA A Color");
      await formA.getByRole("button", { name: "Save customer" }).click();

      // Either a conflict error is shown (optimistic locking), or the save
      // succeeds, but B's newer color must never be silently reverted.
      const conflict = formA.getByRole("alert");
      const status = formA.getByRole("status");
      // The action response is async: wait for either outcome before
      // branching, otherwise count() races the response and reads 0.
      await expect(conflict.or(status).first()).toBeVisible();
      if (await conflict.count()) {
        await expect(conflict).toContainText(/changed by someone else|refresh|conflict/i);
      } else {
        await expect(status).toContainText("Customer saved.");
      }

      await pageA.reload();
      const color = await pageA.locator(".card", { hasText: "Edit a customer" }).locator('input[name="color"]').inputValue();
      expect(color, "stale save overwrote the newer color").not.toBe("QA A Color");

      // Leave clean state for screenshots and future runs.
      const restore = pageB.locator(".card", { hasText: "Edit a customer" });
      await pageB.reload();
      await restore.locator('input[name="name"]').fill("QA Edit Test");
      await restore.locator('input[name="color"]').fill("Black");
      await restore.getByRole("button", { name: "Save customer" }).click();
      await expect(restore.getByRole("status")).toContainText("Customer saved.");
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
