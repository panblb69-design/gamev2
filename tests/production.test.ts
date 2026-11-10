import { describe, it, expect } from "vitest";
import { Simulation } from "../src/core/simulation";
import {
  FactoryEngine,
  type FactoryCommand,
} from "../src/manufacturing/engine";
import { OPERATIONS, COSTS } from "../src/manufacturing/catalog";
import { encode, decode } from "../src/save/storage";
import type { GameState } from "../src/core/model";
let serial = 0;
function command(sim: Simulation, c: FactoryCommand, id = `test-${serial++}`) {
  new FactoryEngine(sim.state).command(id, c);
}
function until(sim: Simulation, predicate: () => boolean, max = 10000) {
  for (let i = 0; i < max && !predicate(); i++) sim.step();
  expect(predicate()).toBe(true);
}
function stock(sim: Simulation, id: string) {
  return new FactoryEngine(sim.state).stock(id);
}
function setup(
  definitions = ["M006", "M007", "M011", "M010", "M012"],
  warehouse = true,
) {
  const sim = new Simulation();
  command(sim, { type: "buy-land" });
  command(sim, {
    type: "build-hall",
    rect: { x: 5, y: 5, width: 88, height: 58 },
  });
  if (warehouse) command(sim, { type: "hire", role: "warehouse" });
  definitions.forEach((definitionId, i) => {
    command(sim, {
      type: "place",
      definitionId,
      x: 10 + (i % 3) * 25,
      y: 10 + Math.floor(i / 3) * 20,
      orientation: 0,
    });
    const m = sim.state.machines.at(-1)!;
    command(sim, { type: "hire", role: "operator" });
    command(sim, {
      type: "assign",
      machineId: m.id,
      workerId: sim.state.employees.at(-1)!.id,
    });
    command(sim, { type: "connect", machineId: m.id, utility: "power" });
    command(sim, { type: "connect", machineId: m.id, utility: "air" });
    command(sim, {
      type: "configure",
      machineId: m.id,
      recipeId: OPERATIONS.find((r) => r.machineId === definitionId)!.id,
      enabled: true,
    });
  });
  return sim;
}
function buyKits(sim: Simulation, n: number) {
  for (const [itemId, amount] of Object.entries({
    C001: 56,
    C002: 27,
    C003: 2,
    C004: 1,
    C005: 1,
    C006: 1,
    C007: 2,
    C008: 1,
    U004: 4,
    U005: 0.01,
    U006: 0.01,
    U003: 0.001,
  }))
    command(sim, {
      type: "buy",
      itemId,
      quantity: Math.round(amount * n * 1000) / 1000,
    });
}
function inject(
  sim: Simulation,
  itemId: string,
  quantity: number,
  locationId = "warehouse",
  quality: GameState["lots"][number]["quality"] = "good",
) {
  sim.state.lots.push({
    id: `fixture-${serial++}`,
    batchId: "fixture",
    itemId,
    quantity,
    reserved: 0,
    locationId,
    quality,
    costMinor: 10000,
  });
}
describe("M1 real production acceptance", () => {
  it("T01 debits land and machine once for repeated command ID, rejects collisions", () => {
    const s = new Simulation(),
      initial = s.state.finance.cashMinor;
    command(s, { type: "buy-land" }, "buy-land");
    command(s, { type: "buy-land" }, "buy-land");
    expect(s.state.finance.cashMinor).toBe(initial - COSTS.land);
    command(s, {
      type: "build-hall",
      rect: { x: 5, y: 5, width: 88, height: 58 },
    });
    const before = s.state.finance.cashMinor;
    const c = {
      type: "place",
      definitionId: "M007",
      x: 10,
      y: 10,
      orientation: 0,
    } as const;
    command(s, c, "place");
    command(s, c, "place");
    expect(before - s.state.finance.cashMinor).toBe(400000000);
    expect(s.state.machines).toHaveLength(1);
    expect(() => command(s, c)).toThrow("Kolize");
    expect(() => command(s, { ...c, x: 1 })).toThrow("uvnitř");
  });
  it("T02 missing one outlet tube prevents assembly", () => {
    const s = setup();
    buyKits(s, 1);
    const delivery = s.state.factory.deliveries.find(
      (d) => d.itemId === "C005",
    )!;
    s.state.factory.deliveries = s.state.factory.deliveries.filter(
      (d) => d.id !== delivery.id,
    );
    s.state.factory.events = s.state.factory.events.filter(
      (e) => e.id !== delivery.id,
    ); // use missing stock scenario without altering event heap order
    // Restore heap deterministically after fixture change.
    s.state.factory.events.sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (let i = 0; i < 1000; i++) s.step();
    expect(stock(s, "W001")).toBe(0);
    expect(s.state.factory.machines.every((m) => m.completed === 0)).toBe(true);
  });
  it("T03 real cleaning, assembly, delayed cooperation, test and pack conserve the exact BOM", () => {
    const s = setup();
    buyKits(s, 1);
    until(s, () => stock(s, "W001") === 1);
    expect(stock(s, "C001")).toBe(0);
    expect(stock(s, "C002")).toBe(0);
    expect(
      s.state.lots
        .filter((l) => l.itemId === "C007")
        .reduce((n, l) => n + l.quantity, 0),
    ).toBe(2);
    command(s, { type: "cooperate", quantity: 1 });
    expect(stock(s, "W004")).toBe(0);
    until(s, () => stock(s, "FE-HX001") === 1);
    expect(stock(s, "C007")).toBe(0);
    expect(stock(s, "C008")).toBe(0);
    expect(s.state.factory.tested).toBe(1);
    expect(s.state.factory.rejected).toBe(0);
    expect(s.state.lots.every((l) => l.quantity >= 0)).toBe(true);
  });
  it("T04 output buffer blocks then resumes after physical collection", () => {
    const s = setup(["M007"], false),
      m = s.state.factory.machines[0]!;
    m.outputCapacity = 1;
    inject(s, "W002", 3, `${m.id}:in`);
    command(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "assemble",
      enabled: true,
    });
    until(s, () => m.completed === 1);
    expect(m.reason).toContain("Plný");
    for (let i = 0; i < 20; i++) s.step();
    expect(m.completed).toBe(1);
    command(s, { type: "hire", role: "warehouse" });
    until(s, () => m.completed >= 2);
    expect(s.state.factory.totalTransfers).toBeGreaterThan(0);
  });
  it("T05 actual assembly cycles retain nominal 15/h per station", () => {
    const s = setup(["M007", "M007", "M007"], false);
    s.state.rngState = 42;
    for (const m of s.state.factory.machines) {
      m.outputCapacity = 100;
      inject(s, "W002", 20, `${m.id}:in`);
    }
    const start = s.state.tick;
    command(s, {
      type: "configure",
      machineId: s.state.factory.machines[0]!.id,
      recipeId: "assemble",
      enabled: true,
    });
    while (s.state.tick < start + 100) s.step();
    expect(s.state.factory.machines.map((m) => m.completed)).toEqual([
      15, 15, 15,
    ]);
    expect(
      s.state.factory.machines.slice(0, 2).reduce((n, m) => n + m.completed, 0),
    ).toBe(30);
  });
  it("T06 cooperation consumes cores once, costs money, and takes two days", () => {
    const s = setup([]);
    inject(s, "W001", 2);
    const cash = s.state.finance.cashMinor;
    command(s, { type: "cooperate", quantity: 2 }, "external");
    command(s, { type: "cooperate", quantity: 2 }, "external");
    expect(stock(s, "W001")).toBe(0);
    expect(s.state.finance.cashMinor).toBe(cash - 2 * COSTS.cooperationPerCore);
    expect(stock(s, "W004")).toBe(0);
    expect(() => command(s, { type: "cooperate", quantity: 2 })).toThrow();
    until(s, () => stock(s, "W004") === 2);
    expect(s.state.tick * 36).toBeGreaterThanOrEqual(2 * 86400);
  });
  it("T07 failed test quarantines core and cannot become good product", () => {
    const s = setup(["M011", "M010", "M012"]);
    let seed = 0;
    while (((Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296 >= 0.03)
      seed++;
    s.state.rngState = seed;
    inject(s, "W004", 1);
    inject(s, "U003", 0.001);
    command(s, {
      type: "configure",
      machineId: s.state.factory.machines[0]!.id,
      recipeId: "leak-test",
      enabled: true,
    });
    until(s, () => s.state.factory.tested === 1);
    until(s, () =>
      s.state.lots.some(
        (l) => l.quality === "quarantine" && l.locationId === "warehouse",
      ),
    );
    expect(s.state.factory.rejected).toBe(1);
    expect(stock(s, "W005")).toBe(0);
    expect(stock(s, "FE-HX001")).toBe(0);
  });
  it("T08 shipment creates receivable, payment alone credits cash at maturity", () => {
    const s = setup([], false);
    inject(s, "FE-HX001", 10);
    command(s, { type: "accept", contractId: "HX-001" });
    const cash = s.state.finance.cashMinor;
    command(s, { type: "ship", contractId: "HX-001" }, "ship");
    command(s, { type: "ship", contractId: "HX-001" }, "ship");
    expect(s.state.finance.cashMinor).toBe(cash - 10 * COSTS.shippingPerUnit);
    expect(s.state.finance.receivablesMinor).toBe(1850000);
    expect(stock(s, "FE-HX001")).toBe(0);
    const due = s.state.factory.invoices[0]!.due;
    while ((s.state.tick + 1) * 36 < due) s.step();
    const before = s.state.finance.cashMinor;
    s.step();
    expect(s.state.finance.cashMinor).toBe(before + 1850000);
    expect(s.state.finance.receivablesMinor).toBe(0);
  });
  it("T09 save/load while production and transfers run is deterministic and lossless", () => {
    const a = setup();
    buyKits(a, 3);
    until(a, () => a.state.factory.transfers.some((t) => t.started !== null));
    const b = new Simulation(decode(encode(a.state)));
    for (let i = 0; i < 2000; i++) {
      a.step();
      b.step();
    }
    expect(b.state).toEqual(a.state);
    expect(decode(encode(b.state))).toEqual(a.state);
  });
  it("full contract is made from purchased parts, shipped and paid after a save/load", () => {
    const a = setup();
    a.state.rngState = 42;
    buyKits(a, 12);
    command(a, { type: "accept", contractId: "HX-001" });
    until(a, () => stock(a, "W001") === 12);
    command(a, { type: "cooperate", quantity: 12 });
    until(a, () => stock(a, "FE-HX001") >= 10);
    command(a, { type: "ship", contractId: "HX-001" });
    expect(a.state.factory.shipped).toBe(10);
    expect(a.state.finance.receivablesMinor).toBe(1850000);
    const b = new Simulation(decode(encode(a.state)));
    until(b, () => b.state.factory.contracts[0]!.status === "paid", 80000);
    expect(b.state.finance.receivablesMinor).toBe(0);
    expect(b.state.finance.revenueMinor).toBe(1850000);
    expect(b.state.factory.invoices).toHaveLength(1);
    expect(() => encode(b.state)).not.toThrow();
  });
  it("T10 several weeks have bounded jobs and no negative inventory or phantom revenue", () => {
    const s = setup();
    buyKits(s, 5);
    for (let i = 0; i < 28 * 2400; i++) s.step();
    expect(
      s.state.lots.every(
        (l) =>
          l.quantity > 0 &&
          l.reserved >= -1e-6 &&
          l.reserved <= l.quantity + 1e-6,
      ),
    ).toBe(true);
    expect(s.state.factory.events.length).toBeLessThan(10);
    expect(s.state.factory.transfers).toHaveLength(0);
    expect(s.state.factory.ledger.length).toBeLessThanOrEqual(200);
    expect(s.state.finance.revenueMinor).toBe(0);
    expect(stock(s, "W001")).toBe(5);
    expect(() => encode(s.state)).not.toThrow();
  });
  it("power and personnel are hard gates; raw material production creates counted batches and scrap", () => {
    const s = setup(["M001"]);
    const m = s.state.factory.machines[0]!;
    m.power = false;
    inject(s, "R001", 2.1, `${m.id}:in`);
    command(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "press-plates",
      enabled: true,
    });
    for (let i = 0; i < 10; i++) s.step();
    expect(m.completed).toBe(0);
    command(s, { type: "connect", machineId: m.id, utility: "power" });
    until(s, () => m.completed === 1);
    expect(
      s.state.lots
        .filter((l) => l.itemId === "C001")
        .reduce((n, l) => n + l.quantity, 0),
    ).toBe(56);
    expect(s.state.lots.find((l) => l.itemId === "SCRAP-AL")?.quantity).toBe(
      0.1,
    );
  });
  it("faults stop production and repair requires mechanic and spare part", () => {
    const s = setup(["M007"], false),
      m = s.state.factory.machines[0]!;
    s.state.machines[0]!.condition = 0.00001;
    inject(s, "W002", 2, `${m.id}:in`);
    command(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "assemble",
      enabled: true,
    });
    until(s, () => s.state.machines[0]!.status === "fault");
    expect(() => command(s, { type: "repair", machineId: m.id })).toThrow(
      "údržbář",
    );
    command(s, { type: "hire", role: "mechanic" });
    expect(() => command(s, { type: "repair", machineId: m.id })).toThrow(
      "materiál",
    );
    inject(s, "SPARE", 1);
    command(s, { type: "repair", machineId: m.id });
    expect(s.state.machines[0]!.status).toBe("maintenance");
    expect(() => encode(s.state)).not.toThrow();
    until(s, () => m.completed === 2);
    expect(stock(s, "SPARE")).toBe(0);
  });
  it("migrates unchanged M0 saves without inventing assets", () => {
    const s = new Simulation().state;
    const old = { ...s, schemaVersion: 1 };
    delete (old as { factory?: unknown }).factory;
    const migrated = decode(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.factory.machines).toEqual([]);
    expect(migrated.finance.cashMinor).toBe(30000000000);
  });
});
