import { test, expect } from "@playwright/test";
test("map, time controls, IDB load and JSON import", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect(page.locator("#cash")).toContainText("300");
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  const date = await page.locator("#date").textContent();
  await page.waitForTimeout(400);
  await expect(page.locator("#date")).toHaveText(date!);
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("uložena");
  await page.getByRole("button", { name: "10×", exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.locator("#date")).not.toHaveText(date!);
  await page.getByRole("button", { name: "Načíst", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("načtena");
  await expect(page.locator("#date")).toHaveText(date!);
  const map = page.locator("#map");
  const r = await map.boundingBox();
  await map.click({ position: { x: r!.width / 2, y: r!.height / 2 } });
  await expect(page.locator("#selected")).toContainText("[");
  await page.getByRole("button", { name: "Přiblížit", exact: true }).click();
  await page.getByRole("button", { name: "Vystředit mapu" }).click();
  await page
    .locator("#import")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(page.getByRole("status")).toContainText("Nepodporovaná");
  await expect(page.locator("#cash")).toContainText("300");
  await page.screenshot({
    path: "test-results/m0-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
