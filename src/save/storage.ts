import { createGame } from "../core/simulation";
import { SPEEDS, type GameState } from "../core/model";
export function decode(text: string): GameState {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== "object")
    throw new Error("Neplatný formát uložené hry.");
  const s = raw as GameState;
  if (s.schemaVersion !== 1)
    throw new Error("Nepodporovaná verze uložené hry.");
  const initial = createGame();
  if (
    !Number.isSafeInteger(s.tick) ||
    s.tick < 0 ||
    !Number.isInteger(s.rngState) ||
    s.rngState < 0 ||
    s.rngState > 0xffffffff ||
    !SPEEDS.includes(s.speed)
  )
    throw new Error("Poškozený čas nebo seed.");
  if (
    !s.world ||
    s.world.width !== initial.world.width ||
    s.world.height !== initial.world.height ||
    s.world.owned !== false
  )
    throw new Error("Neplatná mapa M0.");
  if (
    !s.finance ||
    Object.entries(initial.finance).some(
      ([key, value]) => s.finance[key as keyof typeof s.finance] !== value,
    )
  )
    throw new Error("Neplatné finance M0.");
  for (const key of [
    "machines",
    "lots",
    "employees",
    "logisticsTasks",
  ] as const)
    if (!Array.isArray(s[key]) || s[key].length !== 0)
      throw new Error("Save obsahuje entity nepodporované v M0.");
  return { ...initial, tick: s.tick, rngState: s.rngState, speed: s.speed };
}
export function encode(state: GameState): string {
  const text = JSON.stringify(state);
  decode(text);
  return text;
}
export class SaveStore {
  constructor(private readonly name = "factory-empire") {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Úložiště blokuje jiná karta."));
    });
  }
  async write(state: GameState): Promise<void> {
    const text = encode(state);
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").put(text, "main");
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  async read(): Promise<GameState> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("saves", "readonly");
        const r = tx.objectStore("saves").get("main");
        r.onsuccess = () => {
          try {
            if (typeof r.result !== "string")
              throw new Error("Zatím není uložená hra.");
            resolve(decode(r.result));
          } catch (e) {
            reject(e);
          }
        };
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }
}
