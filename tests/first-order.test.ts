import { expect, it } from "vitest";
import { createGame } from "../src/core/simulation";
import { firstOrderHint } from "../src/ui/first-order";
it("guides a new player through real prerequisites without altering the game", () => {
  const s = createGame(),
    before = structuredClone(s);
  expect(firstOrderHint(s).title).toContain("Kupte pozemek");
  expect(s).toEqual(before);
  s.world.owned = true;
  expect(firstOrderHint(s).title).toContain("Postavte halu");
  s.factory.hall = { x: 5, y: 5, width: 88, height: 58 };
  expect(firstOrderHint(s).body).toContain("M006");
});
it("distinguishes shipment from payment and explains ongoing wages", () => {
  const s = createGame();
  s.world.owned = true;
  s.factory.hall = { x: 5, y: 5, width: 88, height: 58 };
  const c = s.factory.contracts[0]!;
  c.status = "shipped";
  s.factory.invoices.push({
    id: "invoice",
    contractId: c.id,
    quantity: 10,
    amountMinor: 1850000,
    due: 30 * 86400,
    paid: false,
  });
  expect(firstOrderHint(s).body).toContain("30 herních dní");
  expect(firstOrderHint(s).body).toContain("Mzdy");
  c.status = "paid";
  expect(firstOrderHint(s).title).toContain("zaplacená");
});
