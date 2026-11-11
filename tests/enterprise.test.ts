import { describe, it, expect } from "vitest";
import { Simulation } from "../src/core/simulation";
import {
  FactoryEngine,
  type FactoryCommand,
} from "../src/manufacturing/engine";
import { createEnterprise } from "../src/enterprise/state";
import { decode, encode } from "../src/save/storage";
import { usage } from "../src/logistics/warehouse";
import { mrp, capacity } from "../src/planning/planner";
import { onShift } from "../src/workforce/calendar";
import { recordState, oee } from "../src/analytics/metrics";
let id = 0;
function cmd(s: Simulation, c: FactoryCommand) {
  new FactoryEngine(s.state).command("enterprise-test-" + id++, c);
}
function step(s: Simulation, seconds: number) {
  const end = s.state.tick + Math.ceil(seconds / 36);
  while (s.state.tick < end) s.step();
}
function until(s: Simulation, p: () => boolean, seconds = 10 * 86400) {
  for (let i = 0; i < seconds / 36 && !p(); i++) s.step();
  expect(p()).toBe(true);
}
function factory() {
  const s = new Simulation();
  s.state.rngState = 42;
  cmd(s, { type: "buy-land" });
  cmd(s, { type: "build-hall", rect: { x: 5, y: 5, width: 88, height: 58 } });
  return s;
}
function lot(
  s: Simulation,
  itemId: string,
  quantity: number,
  locationId = "warehouse",
  quality: "good" | "quarantine" | "scrap" = "good",
) {
  const value = {
    id: `fixture-${id++}`,
    itemId,
    quantity,
    reserved: 0,
    locationId,
    quality,
    batchId: `fixture-batch-${id++}`,
    costMinor: 10000,
  };
  s.state.lots.push(value);
  return value;
}
function machine(s: Simulation, definitionId: string, x = 10, y = 10) {
  cmd(s, { type: "place", definitionId, x, y, orientation: 0 });
  const m = s.state.factory.machines.at(-1)!;
  cmd(s, { type: "hire", role: "operator" });
  cmd(s, {
    type: "assign",
    machineId: m.id,
    workerId: s.state.employees.at(-1)!.id,
  });
  cmd(s, { type: "connect", machineId: m.id, utility: "power" });
  cmd(s, { type: "connect", machineId: m.id, utility: "air" });
  return m;
}
function zone(s: Simulation, maxKg = 100, maxM3 = 1, x = 70) {
  cmd(s, {
    type: "zone",
    name: "Test sklad",
    x,
    y: 50,
    width: 6,
    height: 6,
    maxKg,
    maxM3,
    kind: "mixed",
  });
  return s.state.enterprise.zones.at(-1)!;
}
function research(s: Simulation, name: string) {
  cmd(s, { type: "research", researchId: name });
  until(s, () =>
    s.state.enterprise.research.some(
      (r) => r.id === name && r.status === "done",
    ),
  );
}
describe("M2 physical warehousing and transport", () => {
  it("rejects mass/volume overcapacity and preserves FIFO partial transfers", () => {
    const s = factory(),
      z = zone(s, 2, 0.005);
    cmd(s, { type: "hire", role: "warehouse" });
    const l = lot(s, "R001", 5);
    expect(() =>
      cmd(s, { type: "move", lotId: l.id, quantity: 3, to: z.id }),
    ).toThrow("kapacitu");
    cmd(s, { type: "move", lotId: l.id, quantity: 1, to: z.id });
    expect(l.reserved).toBe(1);
    expect(usage(s.state, z.id).kg).toBe(0);
    until(s, () => usage(s.state, z.id).kg === 1);
    expect(l.quantity).toBe(4);
    expect(new FactoryEngine(s.state).stock("R001")).toBe(5);
    expect(() => encode(s.state)).not.toThrow();
  });
  it("reserves incoming capacity so two parallel deliveries cannot overbook a zone", () => {
    const s = factory(),
      z = zone(s, 10, 1);
    for (let i = 0; i < 2; i++)
      cmd(s, { type: "buy", itemId: "R001", quantity: 6 });
    const ds = s.state.factory.deliveries;
    cmd(s, { type: "delivery-zone", deliveryId: ds[0]!.id, zoneId: z.id });
    expect(() =>
      cmd(s, { type: "delivery-zone", deliveryId: ds[1]!.id, zoneId: z.id }),
    ).toThrow("kapacitu");
  });
  it("VZV moves heavy pallets, reserves shared traffic routes and saves active transfers", () => {
    const s = factory(),
      z = zone(s, 1000, 10);
    cmd(s, { type: "hire", role: "warehouse" });
    cmd(s, { type: "hire", role: "warehouse" });
    cmd(s, { type: "vehicle", kind: "forklift" });
    cmd(s, { type: "vehicle", kind: "forklift" });
    const a = lot(s, "R001", 100),
      b = lot(s, "R002", 100);
    cmd(s, { type: "move", lotId: a.id, quantity: 100, to: z.id });
    cmd(s, { type: "move", lotId: b.id, quantity: 100, to: z.id });
    const tasks = s.state.factory.transfers;
    expect(tasks).toHaveLength(2);
    expect(tasks[1]!.started).toBeGreaterThanOrEqual(tasks[0]!.due!);
    const restored = new Simulation(decode(encode(s.state)));
    until(restored, () => restored.state.factory.transfers.length === 0);
    expect(usage(restored.state, z.id).kg).toBe(200);
  });
  it("respects truck delivery windows and separate ramp slots", () => {
    const s = factory();
    cmd(s, { type: "hire", role: "warehouse" });
    cmd(s, { type: "dock", x: 2, y: 4, openHour: 6, closeHour: 22 });
    cmd(s, { type: "buy", itemId: "R001", quantity: 1 });
    cmd(s, { type: "buy", itemId: "R001", quantity: 1 });
    expect(s.state.factory.deliveries.map((d) => d.due)).toEqual([
      6 * 3600,
      6 * 3600 + 900,
    ]);
    step(s, 4 * 3600);
    expect(s.state.lots).toHaveLength(0);
    until(s, () => new FactoryEngine(s.state).stock("R001") === 2);
    expect(new FactoryEngine(s.state).stock("R001")).toBe(2);
  });
  it("splits a manual 100kg request into capacity-limited physical jobs without losing quantity", () => {
    const s = factory(),
      z = zone(s, 1000, 10);
    cmd(s, { type: "hire", role: "warehouse" });
    const l = lot(s, "R001", 100);
    cmd(s, { type: "move", lotId: l.id, quantity: 100, to: z.id });
    expect(s.state.factory.transfers).toHaveLength(4);
    expect(l.reserved).toBe(100);
    until(s, () => s.state.factory.transfers.length === 0);
    expect(usage(s.state, z.id).kg).toBe(100);
  });
  it("large receipts split into mass-limited containers while preserving total value", () => {
    const s = factory();
    cmd(s, { type: "buy", itemId: "R001", quantity: 4000 });
    until(s, () => s.state.factory.deliveries.length === 0);
    expect(s.state.lots.reduce((n, l) => n + l.quantity, 0)).toBe(4000);
    expect(s.state.lots.reduce((n, l) => n + l.costMinor, 0)).toBe(4000 * 8500);
    for (const c of s.state.enterprise.containers) {
      const l = s.state.lots.find((l) => l.id === c.lotId)!;
      expect(l.quantity).toBeLessThanOrEqual(c.maxKg);
    }
    expect(s.state.enterprise.containers).toHaveLength(3);
  });
  it("falls back to a light manual job when a forklift cannot enter a narrow aisle", () => {
    const s = factory();
    cmd(s, { type: "hire", role: "warehouse" });
    cmd(s, { type: "vehicle", kind: "forklift" });
    for (const x of [10, 16])
      cmd(s, {
        type: "zone",
        name: "Regály",
        x,
        y: 10,
        width: 5,
        height: 10,
        maxKg: 100,
        maxM3: 10,
        kind: "mixed",
      });
    const l = lot(s, "R001", 1),
      target = s.state.enterprise.zones.at(-1)!.id;
    cmd(s, { type: "move", lotId: l.id, quantity: 1, to: target });
    expect(s.state.enterprise.transport[0]!.mode).toBe("manual");
    until(s, () => s.state.factory.transfers.length === 0);
    expect(usage(s.state, target).kg).toBe(1);
  });
  it("blocks placing machines through storage zones", () => {
    const s = factory();
    zone(s, 100, 10, 10);
    expect(() => machine(s, "M007", 10, 50)).toThrow("Kolize");
  });
});
describe("M3 planning and contracts", () => {
  it("MRP subtracts stock and open deliveries without generating products", () => {
    const s = factory();
    lot(s, "C001", 56);
    cmd(s, { type: "buy", itemId: "C002", quantity: 27 });
    const rows = mrp(s.state, 2);
    expect(rows.find((r) => r.itemId === "C001")!.shortage).toBe(56);
    expect(rows.find((r) => r.itemId === "C002")!.shortage).toBe(27);
    expect(new FactoryEngine(s.state).stock("FE-HX001")).toBe(0);
  });
  it("production plans reserve stock, release missing purchases once and survive saves", () => {
    const s = factory();
    cmd(s, { type: "accept", contractId: "HX-001" });
    lot(s, "C001", 560);
    cmd(s, { type: "plan", contractId: "HX-001", makeComponents: false });
    const p = s.state.enterprise.plans[0]!;
    expect(
      s.state.enterprise.allocations.reduce((n, a) => n + a.quantity, 0),
    ).toBe(560);
    expect(new FactoryEngine(s.state).stock("C001")).toBe(0);
    expect(() => encode(s.state)).not.toThrow();
    cmd(s, { type: "release-plan", planId: p.id });
    expect(s.state.enterprise.allocations).toHaveLength(0);
    expect(new FactoryEngine(s.state).stock("C001")).toBe(560);
    expect(s.state.factory.deliveries.some((d) => d.itemId === "C001")).toBe(
      false,
    );
    const count = s.state.factory.deliveries.length;
    expect(() => cmd(s, { type: "release-plan", planId: p.id })).toThrow();
    expect(s.state.factory.deliveries).toHaveLength(count);
    expect(() => encode(s.state)).not.toThrow();
  });
  it("creates monthly calloffs only over the agreed framework term", () => {
    const s = factory();
    cmd(s, {
      type: "framework",
      quantity: 20,
      productId: "FE-HX001",
      months: 2,
    });
    step(s, 61 * 86400);
    expect(
      s.state.factory.contracts.filter((c) => c.id.startsWith("calloff")),
    ).toHaveLength(2);
    expect(s.state.enterprise.frameworks[0]!.active).toBe(false);
    expect(s.state.finance.revenueMinor).toBe(0);
  });
  it("charges overdue penalties once per day without a second charge after save/load", () => {
    const s = factory();
    cmd(s, { type: "accept", contractId: "HX-001" });
    s.state.factory.contracts[0]!.deadline = 3600;
    step(s, 2 * 86400);
    const fee = s.state.finance.expensesMinor;
    expect(fee).toBeGreaterThan(0);
    const b = new Simulation(decode(encode(s.state)));
    step(s, 3600);
    step(b, 3600);
    expect(b.state.finance).toEqual(s.state.finance);
  });
  it("evaluates price bids without crediting money or producing goods", () => {
    const s = factory();
    cmd(s, { type: "quote", contractId: "HX-001", priceMinor: 180000 });
    expect(s.state.enterprise.quotes["HX-001"]!.accepted).toBe(true);
    expect(s.state.factory.contracts[0]!.status).toBe("accepted");
    expect(s.state.finance.revenueMinor).toBe(0);
    expect(new FactoryEngine(s.state).stock("FE-HX001")).toBe(0);
    expect(() =>
      cmd(s, { type: "quote", contractId: "HX-001", priceMinor: 180000 }),
    ).toThrow();
  });
  it("generates deterministic market offers and detects missing capacity", () => {
    const a = factory(),
      b = factory();
    cmd(a, { type: "market" });
    cmd(b, { type: "market" });
    expect(a.state.factory.contracts.at(-1)!.quantity).toBe(
      b.state.factory.contracts.at(-1)!.quantity,
    );
    expect(capacity(a.state).perHour).toBe(0);
  });
});
describe("M4 shifts, qualifications and maintenance", () => {
  it("handles overnight shifts, absences and insufficient time before shift end", () => {
    const s = factory();
    cmd(s, { type: "hire", role: "operator" });
    const w = s.state.employees[0]!;
    cmd(s, { type: "shift", workerId: w.id, shift: "night" });
    expect(onShift(s.state, w, 23 * 3600, 3600)).toBe(true);
    expect(onShift(s.state, w, 5 * 3600, 3600)).toBe(true);
    expect(onShift(s.state, w, 5 * 3600 + 1800, 3600)).toBe(false);
    expect(onShift(s.state, w, 12 * 3600)).toBe(false);
    cmd(s, { type: "absence", workerId: w.id, days: 1 });
    expect(onShift(s.state, w, 23 * 3600)).toBe(false);
  });
  it("specialist qualifications and wages come from the profession catalogue", () => {
    const s = factory(),
      m = machine(s, "M009");
    cmd(s, { type: "hire", role: "technologist" });
    const specialist = s.state.employees.at(-1)!;
    expect(specialist.wageMinor).toBe(300000);
    cmd(s, { type: "assign", machineId: m.id, workerId: specialist.id });
    expect(onShift(s.state, specialist, 0, 100, "CAB")).toBe(true);
    expect(() => encode(s.state)).not.toThrow();
  });
  it("training consumes time and money and persists a real completion event", () => {
    const s = factory();
    cmd(s, { type: "hire", role: "operator" });
    const w = s.state.employees[0]!,
      cash = s.state.finance.cashMinor;
    cmd(s, { type: "train", workerId: w.id, skill: "CAB" });
    expect(s.state.finance.cashMinor).toBe(cash - 1000000);
    expect(onShift(s.state, w, 0, 0, "CAB")).toBe(false);
    const b = new Simulation(decode(encode(s.state)));
    step(b, 86400);
    expect(b.state.enterprise.workerProfiles[w.id]!.skills).toContain("CAB");
    expect(onShift(b.state, b.state.employees[0], 86400, 100, "CAB")).toBe(
      true,
    );
  });
  it("a machine waits off shift and resumes at the next scheduled boundary", () => {
    const s = factory(),
      m = machine(s, "M007");
    const w = s.state.employees.find((w) => w.id === m.workerId)!;
    cmd(s, { type: "shift", workerId: w.id, shift: "morning" });
    lot(s, "W002", 1, `${m.id}:in`);
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "assemble",
      enabled: true,
    });
    expect(m.completed).toBe(0);
    expect(m.due).toBeNull();
    step(s, 6 * 3600);
    until(s, () => m.completed === 1, 3600);
  });
  it("hands a shared station from morning to afternoon roster without double assigning people", () => {
    const s = factory(),
      m = machine(s, "M007");
    const first = m.workerId!;
    cmd(s, { type: "hire", role: "operator" });
    const second = s.state.employees.at(-1)!.id;
    cmd(s, { type: "shift", workerId: first, shift: "morning" });
    cmd(s, { type: "shift", workerId: second, shift: "afternoon" });
    cmd(s, { type: "roster", machineId: m.id, workerIds: [first, second] });
    step(s, 14 * 3600);
    lot(s, "W002", 1, `${m.id}:in`);
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "assemble",
      enabled: true,
    });
    expect(m.workerId).toBe(second);
    until(s, () => m.completed === 1, 3600);
    expect(() => encode(s.state)).not.toThrow();
  });
  it("preventive maintenance requires a spare and mechanic and resets condition once", () => {
    const s = factory(),
      m = machine(s, "M007");
    cmd(s, { type: "hire", role: "mechanic" });
    cmd(s, { type: "service", machineId: m.id, intervalCycles: 100 });
    lot(s, "SPARE", 1);
    s.state.machines[0]!.condition = 0.65;
    cmd(s, { type: "preventive", machineId: m.id });
    expect(s.state.machines[0]!.status).toBe("maintenance");
    step(s, 3600);
    expect(s.state.machines[0]!.condition).toBe(1);
    expect(s.state.enterprise.service[m.id]!.lastCycles).toBe(0);
  });
});
describe("M5 own technology, media, waste and genealogy", () => {
  it("CAB cannot start without nitrogen/exhaust/cooling or trained staff", () => {
    const s = factory(),
      m = machine(s, "M009");
    lot(s, "W003", 1, `${m.id}:in`);
    lot(s, "U002", 0.2, `${m.id}:in`);
    lot(s, "U004", 1, `${m.id}:in`);
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "braze",
      enabled: true,
    });
    expect(m.due).toBeNull();
    cmd(s, { type: "train", workerId: m.workerId!, skill: "CAB" });
    step(s, 86400);
    expect(m.due).toBeNull();
    expect(m.reason).toContain("médium");
    for (const kind of ["water", "nitrogen", "exhaust"] as const) {
      cmd(s, { type: "utility-source", kind, x: 2, y: 2, capacity: 20 });
      cmd(s, {
        type: "utility-link",
        machineId: m.id,
        sourceId: s.state.enterprise.utilities.at(-1)!.id,
      });
    }
    until(s, () => m.completed === 1, 3600);
    const core = s.state.lots.find((l) => l.itemId === "W004")!;
    expect(core.quantity).toBe(1);
    expect(s.state.lots.some((l) => l.itemId === "W003")).toBe(false);
    expect(
      s.state.enterprise.genealogy.find((b) => b.id === core.batchId)?.recipeId,
    ).toBe("braze");
  });
  it("limits throughput by actual CAB cycles to 36 per hour", () => {
    const s = factory(),
      m = machine(s, "M009");
    cmd(s, { type: "train", workerId: m.workerId!, skill: "CAB" });
    step(s, 86400);
    for (const kind of ["water", "nitrogen", "exhaust"] as const) {
      cmd(s, { type: "utility-source", kind, x: 2, y: 2, capacity: 20 });
      cmd(s, {
        type: "utility-link",
        machineId: m.id,
        sourceId: s.state.enterprise.utilities.at(-1)!.id,
      });
    }
    lot(s, "W003", 40, `${m.id}:in`);
    lot(s, "U002", 8, `${m.id}:in`);
    lot(s, "U004", 40, `${m.id}:in`);
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "braze",
      enabled: true,
    });
    step(s, 3600);
    expect(m.completed).toBe(36);
    expect(new FactoryEngine(s.state).stock("W003", `${m.id}:in`)).toBe(3);
  });
  it("rejects disabled sources and sells metal waste while quarantine costs cash", () => {
    const s = factory();
    const scrap = lot(s, "SCRAP-AL", 2, "warehouse", "scrap"),
      bad = lot(s, "W004", 1, "warehouse", "quarantine"),
      cash = s.state.finance.cashMinor;
    cmd(s, { type: "waste", lotId: scrap.id, quantity: 2 });
    expect(s.state.finance.cashMinor).toBe(cash + 4000);
    cmd(s, { type: "waste", lotId: bad.id, quantity: 1 });
    expect(s.state.finance.cashMinor).toBeLessThan(cash + 4000);
    expect(new FactoryEngine(s.state).stock("W004")).toBe(0);
  });
});
describe("M6 automation, MES and product variants", () => {
  it("research does not unlock instantly, then a robot actually produces without an operator", () => {
    const s = factory(),
      m = machine(s, "M007");
    cmd(s, { type: "research", researchId: "automation" });
    expect(() => cmd(s, { type: "robot", machineId: m.id })).toThrow("výzkum");
    step(s, 2 * 86400);
    cmd(s, { type: "robot", machineId: m.id });
    lot(s, "W002", 1, `${m.id}:in`);
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "assemble",
      enabled: true,
    });
    until(s, () => m.completed === 1);
    expect(m.workerId).toBeNull();
  });
  it("AGV transfers a physical pallet without a warehouse worker", () => {
    const s = factory(),
      z = zone(s, 1000, 10);
    research(s, "automation");
    cmd(s, { type: "vehicle", kind: "agv" });
    const material = lot(s, "R001", 100);
    cmd(s, { type: "move", lotId: material.id, quantity: 100, to: z.id });
    expect(s.state.factory.transfers[0]!.workerId).toBeNull();
    expect(s.state.enterprise.transport[0]!.mode).toBe("agv");
    until(s, () => usage(s.state, z.id).kg === 100);
    expect(s.state.lots.find((l) => l.id === material.id)).toBeUndefined();
  });
  it("a conveyor drives a real output transfer and preserves reservations", () => {
    const s = factory(),
      m = machine(s, "M007");
    research(s, "automation");
    cmd(s, { type: "conveyor", from: `${m.id}:out`, to: "warehouse" });
    lot(s, "W002", 1, `${m.id}:in`);
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "assemble",
      enabled: true,
    });
    until(s, () =>
      s.state.factory.transfers.some((t) => t.from === `${m.id}:out`),
    );
    expect(s.state.enterprise.transport[0]!.mode).toBe("conveyor");
    until(s, () => new FactoryEngine(s.state).stock("W001") === 1);
  });
  it("export variant consumes two packaging sets and cannot be manufactured before research", () => {
    const s = factory(),
      m = machine(s, "M012");
    expect(() =>
      cmd(s, {
        type: "configure",
        machineId: m.id,
        recipeId: "pack-export",
        enabled: true,
      }),
    ).toThrow("výzkum");
    research(s, "export-product");
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: "pack-export",
      enabled: true,
    });
    lot(s, "W006", 1, `${m.id}:in`);
    lot(s, "C007", 2, `${m.id}:in`);
    lot(s, "C008", 2, `${m.id}:in`);
    expect(s.state.machines[0]!.status).toBe("changeover");
    until(s, () => m.completed === 1);
    expect(s.state.lots.find((l) => l.itemId === "FE-HX001-P")!.quantity).toBe(
      1,
    );
    expect(s.state.lots.some((l) => l.itemId === "C008")).toBe(false);
  });
  it("MES replenishes a shortage once and counts pending deliveries", () => {
    const s = factory();
    research(s, "mes");
    cmd(s, {
      type: "replenish",
      itemId: "C001",
      minimum: 10,
      target: 100,
      enabled: true,
    });
    step(s, 3600);
    expect(
      s.state.factory.deliveries.filter((d) => d.itemId === "C001"),
    ).toHaveLength(1);
    step(s, 3600);
    expect(
      s.state.factory.deliveries.filter((d) => d.itemId === "C001"),
    ).toHaveLength(1);
    until(s, () => new FactoryEngine(s.state).stock("C001") === 100);
  });
  it("OEE multiplies availability/performance/quality exactly once", () => {
    const s = factory();
    recordState(s.state, "test", "running", 0);
    recordState(s.state, "test", "starved", 100);
    const metric = s.state.enterprise.metrics.test!;
    metric.cycles = 10;
    metric.good = 8;
    metric.idealSeconds = 80;
    const report = oee(s.state, "test", 200);
    expect(report.availability).toBe(0.5);
    expect(report.performance).toBe(0.8);
    expect(report.quality).toBe(0.8);
    expect(report.oee).toBeCloseTo(0.32);
  });
  it("migrates M1 saves and preserves active advanced systems roundtrip", () => {
    const s = factory();
    const old = { ...s.state, schemaVersion: 2 };
    delete (old as { enterprise?: unknown }).enterprise;
    const restored = decode(JSON.stringify(old));
    expect(restored.schemaVersion).toBe(3);
    expect(restored.enterprise).toEqual(createEnterprise());
    expect(decode(encode(s.state))).toEqual(s.state);
  });
});

describe("bounded queues and trace history", () => {
  it("compacts closed history but retains ancestors of live material", () => {
    const s = factory();
    cmd(s, { type: "hire", role: "operator" });
    const rows = s.state.enterprise.genealogy;
    for (let i = 0; i < 6000; i++)
      rows.push({
        id: `history-${i}`,
        parents: i === 1 ? ["history-0"] : [],
        itemId: "W001",
        quantity: 1,
        at: 0,
        recipeId: "assemble",
        quality: "good",
      });
    const live = lot(s, "W001", 1);
    live.batchId = "history-1";
    step(s, 86400);
    expect(s.state.enterprise.genealogy.length).toBeLessThan(3000);
    expect(s.state.enterprise.genealogy.some((b) => b.id === "history-0")).toBe(
      true,
    );
    expect(s.state.enterprise.genealogy.some((b) => b.id === "history-1")).toBe(
      true,
    );
    expect(() => encode(s.state)).not.toThrow();
  });
});
