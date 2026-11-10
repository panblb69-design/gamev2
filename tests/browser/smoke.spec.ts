import { test, expect } from "@playwright/test";
test("map, time controls, IDB load and JSON import", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect(page.locator("#cash")).toContainText("300");
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pauza", exact: true }),
  ).toBeEnabled();
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
  const row = page.locator("#catalog details").filter({
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

test("management panels execute warehouse, market, shift, network and research commands", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await page.locator("#buy-land").click();
  await page.locator("#build-hall").click();
  await page
    .getByRole("button", { name: "Najmout operátora", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Řízení závodu", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page
    .getByRole("button", { name: "Postavit skladovou zónu", exact: true })
    .click();
  await expect(dialog.locator("#zones-report")).toContainText(/10\s000/);
  await page
    .getByRole("button", { name: "Postavit rampu", exact: true })
    .click();
  await expect(dialog.locator("#docks-report")).toContainText("6–22");
  await page
    .getByRole("button", { name: "Plánování a obchod", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Načíst nové poptávky", exact: true })
    .click();
  await dialog.locator("#framework-months").fill("2");
  await page
    .getByRole("button", { name: "Uzavřít rámcovou smlouvu", exact: true })
    .click();
  await expect(dialog.locator("#framework-report")).toContainText("50 ks");
  await page
    .getByRole("button", { name: "Lidé a údržba", exact: true })
    .click();
  await dialog.locator("#shift-kind").selectOption("morning");
  await page.getByRole("button", { name: "Změnit směnu", exact: true }).click();
  await expect(dialog.locator("#workers-report")).toContainText("Ranní");
  await page
    .getByRole("button", { name: "Rozvody a kvalita", exact: true })
    .click();
  await dialog.locator("#source-kind").selectOption("nitrogen");
  await page
    .getByRole("button", { name: "Pořídit zdroj / rozvodnu", exact: true })
    .click();
  await expect(dialog.locator("#utilities-report")).toContainText("Dusík");
  await page
    .getByRole("button", { name: "Automatizace a MES", exact: true })
    .click();
  await dialog.locator("#research-id").selectOption("mes");
  await page
    .getByRole("button", { name: "Zahájit výzkum", exact: true })
    .click();
  await expect(dialog.locator("#research-report")).toContainText("běží");
  await page.screenshot({
    path: "test-results/management-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.locator("#message")).toContainText("uložena");
  await page.reload();
  await page.getByRole("button", { name: "Načíst", exact: true }).click();
  await expect(page.locator("#message")).toContainText("načtena");
  await page
    .getByRole("button", { name: "Řízení závodu", exact: true })
    .click();
  await expect(dialog.locator("#zones-report")).toContainText(/10\s000/);
  expect(errors).toEqual([]);
});

test("renderer stays responsive while the worker simulates 144 stations and 5000 lots", async ({
  page,
}) => {
  const { stressState } = await import("../fixtures/stress");
  const { encode } = await import("../../src/save/storage");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await page
    .locator("#import")
    .setInputFiles({
      name: "stress.json",
      mimeType: "application/json",
      buffer: Buffer.from(encode(stressState())),
    });
  await expect(page.locator("#message")).toContainText("Soubor byl načten");
  await page.getByRole("button", { name: "10×", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "10×", exact: true }),
  ).toBeEnabled();
  const frames = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const sample = () => {
          frames++;
          if (performance.now() - start >= 1200) resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(frames).toBeGreaterThan(10);
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pauza", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/stress-browser.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("JSON export gets an acknowledged worker snapshot and can be imported again", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pauza", exact: true }),
  ).toBeEnabled();
  await page.locator("#buy-land").click();
  await expect(page.locator("#message")).toContainText("proveden");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloading;
  await page.locator("#import").setInputFiles((await download.path())!);
  await expect(page.locator("#message")).toContainText("Soubor byl načten");
  await expect(page.locator("#cash")).toContainText("250");
});
