import type { GameState } from "../core/model";
import { parseSave } from "./schema";
export function decode(text: string): GameState {
  return parseSave(JSON.parse(text));
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
