import { it, expect } from "vitest";
import { Simulation } from "../src/core/simulation";
import {
  FactoryEngine,
  type FactoryCommand,
} from "../src/manufacturing/engine";
import { requirements } from "../src/planning/planner";
import { encode, decode } from "../src/save/storage";
import { onShift } from "../src/workforce/calendar";
let sequence = 0;
const cmd = (s: Simulation, c: FactoryCommand) =>
  new FactoryEngine(s.state).command(`campaign-${sequence++}`, c);
function run(s: Simulation, p: () => boolean, days = 90) {
  for (let i = 0; i < days * 2400 && !p(); i++) {
    for (const placed of s.state.machines.filter((m) => m.status === "fault")) {
      try {
        cmd(s, { type: "repair", machineId: placed.id });
      } catch {
        /* Resources, shift and cash remain real prerequisites. */
      }
    }
    s.step();
  }
  expect(p()).toBe(true);
}
it("complete M2–M6 campaign: MRP, shifts, raw manufacture, local CAB, export product, automation, trace and paid invoice after reload", () => {
  const s = new Simulation();
  s.state.rngState = 42;
  cmd(s, { type: "buy-land" });
  cmd(s, { type: "build-hall", rect: { x: 5, y: 5, width: 88, height: 58 } });
  const rows: [string, number, number][] = [
    ["M001", 10, 10],
    ["M004", 30, 10],
    ["M005", 45, 10],
    ["M006", 60, 10],
    ["M007", 75, 10],
    ["M008", 10, 28],
    ["M009", 25, 28],
    ["M011", 60, 28],
    ["M010", 10, 45],
    ["M012", 35, 45],
  ];
  for (const [definitionId, x, y] of rows) {
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
  }
  cmd(s, { type: "hire", role: "warehouse" });
  cmd(s, { type: "hire", role: "mechanic" });
  cmd(s, { type: "vehicle", kind: "forklift" });
  cmd(s, { type: "dock", x: 2, y: 4, openHour: 6, closeHour: 22 });
  cmd(s, {
    type: "zone",
    name: "Suroviny a WIP",
    x: 80,
    y: 48,
    width: 8,
    height: 8,
    maxKg: 20000,
    maxM3: 100,
    kind: "mixed",
  });
  const cab = s.state.factory.machines.find(
    (m) => s.state.machines.find((p) => p.id === m.id)!.definitionId === "M009",
  )!;
  cmd(s, { type: "train", workerId: cab.workerId!, skill: "CAB" });
  for (const researchId of ["automation", "export-product", "mes"])
    cmd(s, { type: "research", researchId });
  cmd(s, { type: "policy", key: "localBrazing", enabled: true });
  cmd(s, { type: "policy", key: "detailedUtilities", enabled: true });
  for (const kind of [
    "power",
    "air",
    "water",
    "nitrogen",
    "exhaust",
  ] as const) {
    cmd(s, {
      type: "utility-source",
      kind,
      x: 2,
      y: 2,
      capacity: kind === "power" ? 1500 : 100,
    });
    const sourceId = s.state.enterprise.utilities.at(-1)!.id;
    for (const m of s.state.factory.machines)
      cmd(s, { type: "utility-link", machineId: m.id, sourceId });
  }
  run(s, () => s.state.enterprise.research.every((r) => r.status === "done"));
  const assemble = s.state.factory.machines.find(
    (m) => m.recipeId === "assemble",
  )!;
  cmd(s, { type: "robot", machineId: assemble.id });
  cmd(s, { type: "vehicle", kind: "agv" });
  cmd(s, { type: "conveyor", from: `${assemble.id}:out`, to: "warehouse" });
  cmd(s, {
    type: "framework",
    quantity: 10,
    productId: "FE-HX001-P",
    months: 1,
  });
  run(s, () =>
    s.state.factory.contracts.some((c) => c.id.startsWith("calloff")),
  );
  const contract = s.state.factory.contracts.find((c) =>
    c.id.startsWith("calloff"),
  )!;
  cmd(s, { type: "plan", contractId: contract.id, makeComponents: true });
  cmd(s, { type: "release-plan", planId: s.state.enterprise.plans[0]!.id });
  // Two spare sets cover deterministic quality loss without generating replacement products.
  for (const [itemId, quantity] of Object.entries(
    requirements(2, "FE-HX001-P", true, true),
  ))
    cmd(s, {
      type: "buy",
      itemId,
      quantity: Math.ceil(quantity * 1000) / 1000,
    });
  cmd(s, { type: "buy", itemId: "SPARE", quantity: 5 });
  cmd(s, {
    type: "replenish",
    itemId: "SPARE",
    minimum: 2,
    target: 5,
    enabled: true,
  });
  const pack = s.state.factory.machines.find((m) => m.recipeId === "pack")!;
  cmd(s, {
    type: "configure",
    machineId: pack.id,
    recipeId: "pack-export",
    enabled: true,
  });
  for (const m of s.state.factory.machines.filter((m) => m.id !== pack.id))
    cmd(s, {
      type: "configure",
      machineId: m.id,
      recipeId: m.recipeId,
      enabled: true,
    });
  const press = s.state.factory.machines.find(
    (m) => m.recipeId === "press-plates",
  )!;
  run(s, () => press.completed === 12 && press.due === null);
  cmd(s, {
    type: "configure",
    machineId: press.id,
    recipeId: "press-supports",
    enabled: true,
  });
  run(s, () => new FactoryEngine(s.state).stock("FE-HX001-P") >= 10);
  expect(s.state.factory.cooperations).toHaveLength(0);
  expect(s.state.enterprise.inspections.length).toBeGreaterThanOrEqual(10);
  expect(
    s.state.enterprise.genealogy.some(
      (b) => b.recipeId === "braze" && b.parents.length > 0,
    ),
  ).toBe(true);
  expect(
    s.state.enterprise.transport.some((t) => t.mode === "agv") ||
      s.state.factory.totalTransfers > 0,
  ).toBe(true);
  cmd(s, { type: "ship", contractId: contract.id });
  const receivable = s.state.finance.receivablesMinor;
  expect(receivable).toBe(2050000);
  const restored = new Simulation(decode(encode(s.state)));
  run(
    restored,
    () =>
      restored.state.factory.contracts.find((c) => c.id === contract.id)!
        .status === "paid",
  );
  expect(restored.state.finance.receivablesMinor).toBe(0);
  expect(restored.state.finance.revenueMinor).toBe(2050000);
  expect(restored.state.enterprise.plans[0]!.status).toBe("done");
  expect(
    restored.state.lots.every((l) => l.quantity > 0 && l.reserved >= 0),
  ).toBe(true);
  expect(
    onShift(
      restored.state,
      restored.state.employees.find((w) => w.id === cab.workerId),
      restored.state.tick * 36,
      0,
      "CAB",
    ),
  ).toBe(true);
  expect(() => encode(restored.state)).not.toThrow();
}, 30000);
