import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import {
  Simulation,
  FixedClock,
  createGame,
  gameDate,
  CONFIG,
} from "../src/core/simulation";
import { encode, decode, SaveStore } from "../src/save/storage";
import { items, machines, product, recipes } from "../src/data/catalog";
describe("fixed step", () => {
  it.each([0, 1, 2, 5, 10] as const)("speed %i", (speed) => {
    const sim = new Simulation();
    sim.setSpeed(speed);
    new FixedClock().advance(100, sim);
    expect(sim.state.tick).toBe(speed * 2);
  });
  it("is independent of render frame partition", () => {
    const a = new Simulation(),
      b = new Simulation(),
      ca = new FixedClock(),
      cb = new FixedClock();
    for (let i = 0; i < 100; i++) ca.advance(10, a);
    for (let i = 0; i < 4; i++) cb.advance(250, b);
    expect(a.state).toEqual(b.state);
  });
  it("converts one day correctly", () => {
    const s = createGame();
    s.tick = 120000 / 50;
    expect(gameDate(s).getTime() - CONFIG.startDateMs).toBe(86400000);
  });
  it("bounds catchup and rejects invalid durations", () => {
    const sim = new Simulation(),
      c = new FixedClock();
    expect(c.advance(1e9, sim)).toBe(5);
    expect(() => c.advance(NaN, sim)).toThrow();
    expect(() => c.advance(-1, sim)).toThrow();
  });
  it("preserves capital and bounded collections for 4 game weeks", () => {
    const sim = new Simulation();
    for (let i = 0; i < 28 * 2400; i++) sim.step();
    expect(sim.state.finance).toEqual(createGame().finance);
    expect(sim.state.machines).toEqual([]);
    expect(sim.state.logisticsTasks).toEqual([]);
    expect(sim.state.tick).toBe(67200);
  });
  it("serializes deterministic PRNG continuation", () => {
    const a = new Simulation(createGame(42));
    a.random();
    const b = new Simulation(decode(encode(a.state)));
    expect(Array.from({ length: 100 }, () => a.random())).toEqual(
      Array.from({ length: 100 }, () => b.random()),
    );
  });
});
describe("catalog contracts, no production execution", () => {
  it("has exact component BOM with packaging separate", () => {
    expect(product.bom.map((q) => q.amount)).toEqual([
      56, 27, 2, 1, 1, 1, 2, 1,
    ]);
    expect(recipes[0]!.inputs.map((q) => q.amount)).toEqual([
      56, 27, 2, 1, 1, 1,
    ]);
    expect(recipes[1]!.inputs.slice(1).map((q) => q.amount)).toEqual([2, 1]);
  });
  it("resolves IDs, units and recipe machine references", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const r of recipes) {
      expect(machines.some((m) => m.id === r.machineId)).toBe(true);
      for (const q of [...r.inputs, ...r.outputs]) {
        expect(items.find((i) => i.id === q.itemId)?.unit).toBe(q.unit);
        expect(q.amount).toBeGreaterThan(0);
      }
    }
  });
  it("keeps nominal assembly and CAB capacity distinct", () => {
    const rate = machines.find((m) => m.id === "M007")!.throughputPerHour;
    const cab = machines.find((m) => m.id === "M009")!.throughputPerHour;
    expect(rate * 2).toBe(30);
    expect(rate * 3).toBe(45);
    expect(Math.min(rate * 3, cab)).toBe(36);
  });
});
describe("save schema and IndexedDB", () => {
  it("roundtrips a paused game exactly", () => {
    const s = createGame();
    s.tick = 1987;
    s.speed = 0;
    expect(decode(encode(s))).toEqual(s);
  });
  it.each(["{}", "null", "[]", '{"schemaVersion":99}'])(
    "rejects invalid or unknown schema %s",
    (text) => {
      expect(() => decode(text)).toThrow();
    },
  );
  it("rejects corruption and unsupported future entities", () => {
    for (const patch of [
      { tick: -1 },
      { tick: 1.2 },
      { rngState: -1 },
      { speed: 3 },
      { finance: { cashMinor: Infinity } },
      { machines: [{ id: "fake" }] },
    ])
      expect(() =>
        decode(JSON.stringify({ ...createGame(), ...patch })),
      ).toThrow();
  });
  it("persists and replaces one slot through real IDB transactions", async () => {
    const store = new SaveStore("test-save");
    await expect(store.read()).rejects.toThrow();
    const s = createGame();
    s.tick = 20;
    await store.write(s);
    expect(await store.read()).toEqual(s);
    s.tick = 30;
    await store.write(s);
    expect((await store.read()).tick).toBe(30);
  });
});
