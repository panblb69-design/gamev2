/// <reference lib="webworker" />
import { Simulation } from "./simulation";
import type { FactoryCommand } from "../manufacturing/engine";
import type { GameState, Speed } from "./model";
const sim = new Simulation();
let lastSnapshot = 0;
export type WorkerRequest =
  | { id: number; kind: "steps"; count: number; speed: Speed }
  | { id: number; kind: "command"; commandId: string; command: FactoryCommand }
  | { id: number; kind: "replace"; state: GameState }
  | { id: number; kind: "snapshot" };
export interface WorkerReply {
  id: number;
  kind: WorkerRequest["kind"];
  state?: GameState;
  error?: string;
  tickMs?: number;
}
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const r = event.data,
    start = performance.now();
  try {
    if (r.kind === "steps") {
      sim.setSpeed(r.speed);
      for (let i = 0; i < r.count; i++) sim.step();
    }
    if (r.kind === "command") await sim.command(r.commandId, r.command);
    if (r.kind === "replace") sim.state = r.state;
    // Commands are synchronous in headless Simulation; snapshot only copies serializable data.
    const sendState =
      r.kind !== "steps" || performance.now() - lastSnapshot >= 200;
    if (sendState) lastSnapshot = performance.now();
    const reply: WorkerReply = {
      id: r.id,
      kind: r.kind,
      tickMs:
        r.kind === "steps" && r.count
          ? (performance.now() - start) / r.count
          : 0,
      ...(sendState ? { state: sim.state } : {}),
    };
    self.postMessage(reply);
  } catch (error) {
    self.postMessage({
      id: r.id,
      kind: r.kind,
      state: sim.state,
      error: error instanceof Error ? error.message : "Chyba simulace",
    } satisfies WorkerReply);
  }
};
