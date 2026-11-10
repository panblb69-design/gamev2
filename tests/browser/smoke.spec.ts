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
  await page.locator("#import").setInputFiles({
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

test("M1 construction and machine controls use real core commands", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await page.locator("#buy-land").click();
  await expect(page.locator("#cash")).toContainText("250");
  await page.locator("#build-hall").click();
  await expect(page.getByRole("status")).toContainText("proveden");
  await page
    .getByRole("button", { name: "Najmout operátora", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Najmout skladníka", exact: true })
    .click();
  const row = page
    .locator("#catalog details")
    .filter({
      has: page.locator("summary", { hasText: "Montážní pracoviště" }),
    });
  await row.locator("summary").click();
  await row.getByRole("button", { name: "Umístit", exact: true }).click();
  const map = page.locator("#map"),
    box = await map.boundingBox();
  const scale = Math.min((box!.width - 70) / 1000, (box!.height - 70) / 700);
  const position = {
    x: (box!.width - 1000 * scale) / 2 + 105 * scale,
    y: (box!.height - 700 * scale) / 2 + 105 * scale,
  };
  await map.click({ position });
  await expect(page.getByRole("status")).toContainText("proveden");
  await page.getByRole("button", { name: "Zrušit výběr" }).click();
  await map.click({ position });
  await expect(page.locator("#machine-info")).toContainText("Montážní");
  await page
    .getByRole("button", { name: "Připojit elektřinu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Připojit vzduch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Přiřadit volného operátora", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Spustit: Montáž očištěného jádra",
      exact: true,
    })
    .click();
  await expect(page.locator("#machine-info")).toContainText("Chybí vstupy");
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("uložena");
  await page.reload();
  await page.getByRole("button", { name: "Načíst", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("načtena");
  await expect(page.locator("#workers")).toHaveText("2");
  await expect(page.locator("#parcel")).toContainText("Vlastní");
  await page.screenshot({
    path: "test-results/m1-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
