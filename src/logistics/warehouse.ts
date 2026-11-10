import type { GameState, InventoryLot } from "../core/model";
export const storageLocation = (location: string) =>
  location === "warehouse" || location.startsWith("zone-");
// Unverified gameplay conversions; kg/unit and m³/unit, not industrial guarantees.
export function physical(itemId: string): { kg: number; m3: number } {
  const map: Record<string, [number, number]> = {
    C001: [2 / 56, 0.00005],
    C002: [0.48 / 27, 0.0001],
    C003: [0.07, 0.0001],
    C004: [0.12, 0.0003],
    C005: [0.12, 0.0003],
    C006: [0.15, 0.0001],
    C007: [0.005, 0.00001],
    C008: [0.1, 0.003],
    R001: [1, 0.00037],
    R002: [1, 0.00037],
    R004: [1, 0.00037],
    R003: [0.24, 0.001],
    U001: [1, 0.001],
    U002: [1.25, 1],
    U003: [0.18, 1],
    U004: [1, 0.001],
    U005: [1, 0.001],
    U006: [1, 0.001],
    SPARE: [5, 0.02],
    "SCRAP-AL": [1, 0.001],
    "SCRAP-TUBE": [0.24, 0.001],
  };
  const [kg, m3] = map[itemId] ?? [2.5, 0.004];
  return { kg, m3 };
}
export function usage(
  s: GameState,
  location: string,
): { kg: number; m3: number } {
  let kg = 0,
    m3 = 0;
  for (const l of s.lots) {
    if (l.locationId !== location) continue;
    const p = physical(l.itemId);
    kg += l.quantity * p.kg;
    m3 += l.quantity * p.m3;
  }
  return { kg, m3 };
}
export function accepts(
  s: GameState,
  location: string,
  itemId: string,
  quantity: number,
  quality: InventoryLot["quality"] = "good",
): boolean {
  if (location === "warehouse")
    return (
      s.lots
        .filter((l) => l.locationId === location)
        .reduce((n, l) => n + l.quantity, 0) +
        quantity <=
      s.factory.storageCapacity
    );
  const zone = s.enterprise.zones.find((z) => z.id === location);
  if (!zone) return false;
  if (
    zone.kind === "quarantine" &&
    quality !== "quarantine" &&
    quality !== "scrap"
  )
    return false;
  if (zone.kind !== "quarantine" && zone.kind !== "mixed" && quality !== "good")
    return false;
  if (zone.kind === "finished" && !itemId.startsWith("FE-")) return false;
  if (zone.kind === "raw" && itemId.startsWith("W")) return false;
  if (zone.kind === "wip" && !itemId.startsWith("W")) return false;
  const p = physical(itemId),
    u = usage(s, location);
  for (const t of s.factory.transfers.filter((t) => t.to === location)) {
    const lot = s.lots.find((l) => l.id === t.lotId);
    if (lot) {
      const metric = physical(lot.itemId);
      u.kg += t.quantity * metric.kg;
      u.m3 += t.quantity * metric.m3;
    }
  }
  for (const d of s.factory.deliveries.filter(
    (d) => s.enterprise.deliveryZones[d.id] === location,
  )) {
    const metric = physical(d.itemId);
    u.kg += d.quantity * metric.kg;
    u.m3 += d.quantity * metric.m3;
  }
  return (
    u.kg + quantity * p.kg <= zone.maxKg + 1e-6 &&
    u.m3 + quantity * p.m3 <= zone.maxM3 + 1e-6
  );
}
export class InventoryIndex {
  private byKey = new Map<string, InventoryLot[]>();
  private byId = new Map<string, InventoryLot>();
  private byLocation = new Map<string, InventoryLot[]>();
  private central = new Map<string, InventoryLot[]>();
  constructor(lots: InventoryLot[]) {
    for (const l of lots) this.add(l);
  }
  add(l: InventoryLot) {
    const key = l.itemId + "@" + l.locationId;
    let list = this.byKey.get(key);
    if (!list) {
      list = [];
      this.byKey.set(key, list);
    }
    list.push(l);
    this.byId.set(l.id, l);
    let local = this.byLocation.get(l.locationId);
    if (!local) {
      local = [];
      this.byLocation.set(l.locationId, local);
    }
    local.push(l);
    if (storageLocation(l.locationId)) {
      let stored = this.central.get(l.itemId);
      if (!stored) {
        stored = [];
        this.central.set(l.itemId, stored);
      }
      stored.push(l);
    }
  }
  list(itemId: string, location: string): InventoryLot[] {
    return this.byKey.get(itemId + "@" + location) ?? [];
  }
  stored(itemId: string): InventoryLot[] {
    return this.central.get(itemId) ?? [];
  }
  at(location: string): InventoryLot[] {
    return this.byLocation.get(location) ?? [];
  }
  lot(id: string) {
    return this.byId.get(id);
  }
  stock(itemId: string, location: string) {
    return this.list(itemId, location).reduce(
      (n, l) => n + (l.quality === "good" ? l.quantity - l.reserved : 0),
      0,
    );
  }
}
