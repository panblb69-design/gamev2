import { Simulation } from "./simulation";
import type { GameState, Speed } from "./model";
import type { FactoryCommand } from "../manufacturing/engine";
import type { WorkerRequest, WorkerReply } from "./worker";
import { GAME_SECONDS_PER_TICK } from "./time";
export class BrowserSimulation extends Simulation {
  private worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  private loading = false;
  public error: string | null = null;
  private requestId = 0;
  private pending = new Map<
    number,
    { resolve: () => void; reject: (error: Error) => void }
  >();
  private steps = 0;
  private inFlight = false;
  private snapshotAt = performance.now();
  public lastTickMs = 0;
  public lostWallSteps = 0;
  constructor() {
    super();
    this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const r = event.data;
      if (r.state && (!this.loading || r.kind === "replace")) {
        const speed = this.state.speed;
        this.state = r.state;
        this.state.speed = speed;
        this.snapshotAt = performance.now();
      }
      if (r.kind === "steps") {
        this.inFlight = false;
        this.lastTickMs = r.tickMs ?? 0;
        if (r.error) this.error = r.error;
      }
      const waiter = this.pending.get(r.id);
      if (waiter) {
        this.pending.delete(r.id);
        if (r.error) waiter.reject(new Error(r.error));
        else waiter.resolve();
      }
    };
    this.worker.onerror = () => {
      this.error = "Simulační pracovní proces se zastavil.";
      for (const waiter of this.pending.values())
        waiter.reject(new Error("Simulační pracovní proces se zastavil."));
      this.pending.clear();
    };
  }
  private send(
    request:
      | Omit<Extract<WorkerRequest, { kind: "command" }>, "id">
      | Omit<Extract<WorkerRequest, { kind: "replace" }>, "id">
      | { kind: "snapshot" },
  ): Promise<void> {
    if (this.error) return Promise.reject(new Error(this.error));
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...request, id });
    });
  }
  override setSpeed(speed: Speed): void {
    this.state.speed = speed;
    if (speed === 0) this.steps = 0;
  }
  override step(): void {
    if (this.loading || this.error) return;
    if (this.steps < 50) this.steps++;
    else this.lostWallSteps++;
  }
  override flush(): void {
    if (!this.steps || this.inFlight || this.loading || this.error) return;
    this.inFlight = true;
    this.worker.postMessage({
      id: ++this.requestId,
      kind: "steps",
      count: this.steps,
      speed: this.state.speed,
    } satisfies WorkerRequest);
    this.steps = 0;
  }
  override async command(
    commandId: string,
    command: FactoryCommand,
  ): Promise<void> {
    this.flush();
    await this.send({ kind: "command", commandId, command });
  }
  override async snapshot(): Promise<GameState> {
    this.flush();
    await this.send({ kind: "snapshot" });
    return structuredClone(this.state);
  }
  override async replaceState(state: GameState): Promise<void> {
    this.loading = true;
    this.steps = 0;
    try {
      await this.send({ kind: "replace", state });
      this.state = state;
      this.snapshotAt = performance.now();
    } finally {
      this.loading = false;
    }
  }
  override presentationSeconds(): number {
    return (
      this.state.tick * GAME_SECONDS_PER_TICK +
      (Math.min(250, performance.now() - this.snapshotAt) *
        this.state.speed *
        GAME_SECONDS_PER_TICK) /
        50
    );
  }
}
