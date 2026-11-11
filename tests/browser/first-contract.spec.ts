import { test, expect, type Page } from "@playwright/test";
const stations = [
  { name: "Mytí komponentů", x: 10, y: 10, recipe: "Čištění kompletní sady" },
  {
    name: "Montážní pracoviště",
    x: 30,
    y: 10,
    recipe: "Montáž očištěného jádra",
  },
  { name: "Heliový tester", x: 50, y: 10, recipe: "100% heliový test" },
  { name: "Hydrofilní úprava", x: 10, y: 30, recipe: "Hydrofilní úprava" },
  {
    name: "Finální kontrola a balení",
    x: 35,
    y: 30,
    recipe: "Finální kontrola a balení",
  },
];
async function mapClick(page: Page, x: number, y: number) {
  const box = (await page.locator("#map").boundingBox())!,
    scale = Math.min((box.width - 70) / 1000, (box.height - 70) / 700);
  await page.locator("#map").click({
    position: {
      x: (box.width - 1000 * scale) / 2 + (x * 10 + 5) * scale,
      y: (box.height - 700 * scale) / 2 + (y * 10 + 5) * scale,
    },
  });
}
async function order(page: Page, item: string, quantity: number) {
  await page.locator("#buy-item").selectOption(item);
  await page.locator("#buy-quantity").fill(String(quantity));
  if (item === "U003")
    await expect(page.locator("#buy-quote")).toContainText("2,40");
  const before = await page.locator("#inventory").textContent();
  await page
    .getByRole("button", { name: "Objednat (dodání od 4 h)", exact: true })
    .click();
  await expect(page.locator("#inventory")).not.toHaveText(before!);
}
test("a player completes the first contract through visible UI and understands the receivable", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#map canvas")).toBeVisible();
  await expect(page.locator("#first-order-title")).toContainText(
    "Kupte pozemek",
  );
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pauza", exact: true }),
  ).toBeEnabled();
  await page.locator("#buy-land").click();
  await expect(page.locator("#first-order-title")).toContainText(
    "Postavte halu",
  );
  await page.locator("#build-hall").click();
  await expect(page.locator("#first-order-title")).toContainText(
    "Připravte výrobní",
  );
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "Najmout operátora", exact: true })
      .click();
    await expect(page.locator("#workers")).toHaveText(String(i + 1));
    await page.waitForTimeout(620);
  }
  await page
    .getByRole("button", { name: "Najmout skladníka", exact: true })
    .click();
  await expect(page.locator("#workers")).toHaveText("6");
  await page
    .getByRole("button", { name: "Najmout údržbáře", exact: true })
    .click();
  await expect(page.locator("#workers")).toHaveText("7");
  for (const station of stations) {
    const row = page
      .locator("#catalog details")
      .filter({ has: page.locator("summary", { hasText: station.name }) });
    await row.locator("summary").click();
    await row.getByRole("button", { name: "Umístit", exact: true }).click();
    const cash = await page.locator("#cash").textContent();
    await mapClick(page, station.x, station.y);
    await expect(page.locator("#cash")).not.toHaveText(cash!);
    await page
      .getByRole("button", { name: "Zrušit výběr", exact: true })
      .click();
    await mapClick(page, station.x + 1, station.y + 1);
    await expect(page.locator("#machine-info")).toContainText(station.name);
    await page
      .getByRole("button", { name: "Připojit elektřinu", exact: true })
      .click();
    await expect(page.locator("#machine-info")).toContainText("Elektřina ano");
    await page
      .getByRole("button", { name: "Připojit vzduch", exact: true })
      .click();
    await expect(page.locator("#machine-info")).toContainText("vzduch ano");
    await page
      .getByRole("button", { name: "Přiřadit volného operátora", exact: true })
      .click();
    await expect(page.locator("#machine-info")).not.toContainText("nepřiřazen");
    await page
      .getByRole("button", { name: "Spustit: " + station.recipe, exact: true })
      .click();
    await expect(page.locator("#machine-info")).toContainText("Chybí vstupy");
  }
  await page
    .getByRole("button", { name: "Přijmout HX-001", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Řízení závodu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Plánování a obchod", exact: true })
    .click();
  await page.locator("#plan-contract").selectOption("HX-001");
  await page
    .getByRole("button", { name: "Připravit výrobní příkaz", exact: true })
    .click();
  await expect(page.locator("#release-plan option")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Uvolnit výrobní příkaz", exact: true })
    .click();
  await expect(page.locator("#release-plan option")).toHaveCount(0);
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  // Buy a two-set quality reserve using the same paid ordering controls.
  for (const [item, quantity] of Object.entries({
    C001: 112,
    C002: 54,
    C003: 4,
    C004: 2,
    C005: 2,
    C006: 2,
    C007: 4,
    C008: 2,
    U004: 8,
    U005: 0.02,
    U006: 0.02,
    U003: 0.002,
    SPARE: 5,
  }))
    await order(page, item, quantity);
  await expect(page.locator("#first-order-title")).toContainText("Probíhá");
  await page.getByRole("button", { name: "10×", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "10×", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(
      async () =>
        Number(
          (await page.locator("#cooperation").textContent())?.match(
            /Jádra ve skladu: ([\d.]+)/,
          )?.[1] ?? 0,
        ),
      { timeout: 30000 },
    )
    .toBe(12);
  await page.locator("#coop-quantity").fill("12");
  await page
    .getByRole("button", { name: "Odeslat jádra (2 dny)", exact: true })
    .click();
  await expect(page.locator("#cooperation")).toContainText("V kooperaci: 12");
  await expect
    .poll(
      async () => {
        for (const station of stations) {
          await mapClick(page, station.x + 1, station.y + 1);
          const repair = page.getByRole("button", {
            name: "Opravit (díl + údržbář)",
            exact: true,
          });
          if (await repair.count()) await repair.click();
        }
        return Number(
          (await page.locator("#inventory").textContent())?.match(
            /Zabalený výparník FE-HX001: ([\d.]+)/,
          )?.[1] ?? 0,
        );
      },
      { timeout: 80000, intervals: [500] },
    )
    .toBeGreaterThanOrEqual(10);
  await expect(page.locator("#first-order-title")).toContainText("Expedujte");
  await page
    .getByRole("button", { name: "Expedovat HX-001", exact: true })
    .click();
  await expect(page.locator("#first-order-title")).toContainText(
    "Čekáte na inkaso",
  );
  await expect(page.locator("#accounts")).not.toContainText("Pohledávky: 0 Kč");
  await expect(page.locator("#first-order-body")).toContainText("Mzdy");
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.locator("#message")).toContainText("uložena");
  await page.screenshot({
    path: "test-results/first-contract-shipped.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
