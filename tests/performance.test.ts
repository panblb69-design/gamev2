import { stressState } from "./fixtures/stress";
import { it, expect } from "vitest";
import { Simulation } from "../src/core/simulation";
import { FactoryEngine } from "../src/manufacturing/engine";
import { writeFileSync, mkdirSync } from "node:fs";
import { decode, encode } from "../src/save/storage";
it("benchmarks a valid 144-station floor with 200 people and 5000 stock lots", () => {
  const state = stressState();
  const sim = new Simulation(state);
  const start = performance.now();
  new FactoryEngine(state).command("benchmark-start", {
    type: "configure",
    machineId: state.machines[0]!.id,
    recipeId: "pack",
    enabled: true,
  });
  const samples: number[] = [];
  for (let i = 0; i < 200; i++) {
    const before = performance.now();
    sim.step();
    samples.push(performance.now() - before);
  }
  const elapsedMs = performance.now() - start,
    p95Ms = [...samples].sort((a, b) => a - b)[
      Math.floor(samples.length * 0.95)
    ]!;
  const report = {
    machines: 144,
    people: 200,
    initialLots: 5000,
    ticks: 200,
    gameSeconds: 7200,
    elapsedMs,
    p95Ms,
    maxTickMs: Math.max(...samples),
    completed: state.factory.machines.reduce((n, m) => n + m.completed, 0),
    activeTransfers: state.factory.transfers.length,
    remainingEvents: state.factory.events.length,
  };
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/performance.json", JSON.stringify(report, null, 2));
  expect(report.completed).toBeGreaterThan(144);
  expect(
    state.lots.every((l) => l.quantity > 0 && l.reserved <= l.quantity + 1e-6),
  ).toBe(true);
  expect(() => decode(encode(state))).not.toThrow();
  expect(elapsedMs).toBeLessThan(15000);
}, 30000);
