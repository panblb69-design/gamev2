import { type GameState, type Speed } from "./model";
export const CONFIG = {
  stepMs: 50,
  realSecondsPerDay: 120,
  startDateMs: Date.UTC(2026, 0, 1),
  initialCashMinor: 30_000_000_000,
} as const;
export function createGame(seed = 123456789): GameState {
  return {
    schemaVersion: 1,
    tick: 0,
    rngState: seed >>> 0,
    speed: 1,
    world: { width: 100, height: 70, owned: false },
    finance: {
      cashMinor: CONFIG.initialCashMinor,
      receivablesMinor: 0,
      payablesMinor: 0,
      revenueMinor: 0,
      expensesMinor: 0,
      investorShare: 0.35,
    },
    machines: [],
    lots: [],
    employees: [],
    logisticsTasks: [],
  };
}
export class Simulation {
  constructor(public state: GameState = createGame()) {}
  step(): void {
    this.state.tick++;
  }
  setSpeed(speed: Speed): void {
    this.state.speed = speed;
  }
  // LCG state is serialized; rendering must never consume this stream.
  random(): number {
    this.state.rngState =
      (Math.imul(1664525, this.state.rngState) + 1013904223) >>> 0;
    return this.state.rngState / 4294967296;
  }
}
export class FixedClock {
  private accumulator = 0;
  advance(realMs: number, simulation: Simulation): number {
    if (!Number.isFinite(realMs) || realMs < 0)
      throw new Error("Invalid frame duration");
    this.accumulator += Math.min(realMs, 250) * simulation.state.speed;
    let steps = 0;
    while (this.accumulator + 1e-9 >= CONFIG.stepMs) {
      simulation.step();
      this.accumulator -= CONFIG.stepMs;
      steps++;
    }
    return steps;
  }
  reset(): void {
    this.accumulator = 0;
  }
}
export function gameDate(state: GameState): Date {
  return new Date(
    CONFIG.startDateMs +
      ((state.tick * CONFIG.stepMs) / (CONFIG.realSecondsPerDay * 1000)) *
        86400000,
  );
}
