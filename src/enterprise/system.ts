import { productionRole } from "../workforce/roles";
import { PURCHASE_PRICES } from "../manufacturing/catalog";
import type { GameState, InventoryLot } from "../core/model";
import type { Point, ScheduledEvent } from "../manufacturing/model";
import type { FactoryCommand } from "../manufacturing/engine";
import { path, port, overlap, footprint } from "../world/path";
import { physical, storageLocation, accepts } from "../logistics/warehouse";
import { mrp, PRODUCTS } from "../planning/planner";
import { RESEARCH } from "../automation/research";
import { financialReport, recordState } from "../analytics/metrics";
import { onShift } from "../workforce/calendar";
import type { UtilityKind } from "../infrastructure/networks";
export type AdvancedCommand =
  | {
      type: "zone";
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
      maxKg: number;
      maxM3: number;
      kind: "raw" | "wip" | "finished" | "quarantine" | "mixed";
    }
  | { type: "move"; lotId: string; quantity: number; to: string }
  | { type: "vehicle"; kind: "forklift" | "agv" }
  | { type: "dock"; x: number; y: number; openHour: number; closeHour: number }
  | { type: "delivery-zone"; deliveryId: string; zoneId: string }
  | { type: "plan"; contractId: string; makeComponents: boolean }
  | { type: "release-plan"; planId: string }
  | { type: "framework"; quantity: number; productId: string; months: number }
  | { type: "quote"; contractId: string; priceMinor: number }
  | { type: "roster"; machineId: string; workerIds: string[] }
  | { type: "market" }
  | {
      type: "shift";
      workerId: string;
      shift: "continuous" | "morning" | "afternoon" | "night";
    }
  | { type: "train"; workerId: string; skill: string }
  | { type: "absence"; workerId: string; days: number }
  | { type: "service"; machineId: string; intervalCycles: number }
  | { type: "preventive"; machineId: string }
  | {
      type: "utility-source";
      kind: UtilityKind;
      x: number;
      y: number;
      capacity: number;
    }
  | { type: "utility-link"; machineId: string; sourceId: string }
  | { type: "utility-toggle"; sourceId: string; enabled: boolean }
  | {
      type: "policy";
      key: "localBrazing" | "detailedUtilities" | "autoService";
      enabled: boolean;
    }
  | { type: "waste"; lotId: string; quantity: number }
  | { type: "research"; researchId: string }
  | { type: "robot"; machineId: string }
  | { type: "conveyor"; from: string; to: string }
  | {
      type: "replenish";
      itemId: string;
      minimum: number;
      target: number;
      enabled: boolean;
    };
export interface Host {
  s: GameState;
  now: number;
  id: (prefix: string) => string;
  schedule: (kind: ScheduledEvent["kind"], id: string, at: number) => void;
  spend: (amount: number, kind: string, expense?: boolean) => void;
  consume: (
    itemId: string,
    quantity: number,
    location: string,
  ) => { cost: number; batches: string[] };
  addLot: (
    itemId: string,
    quantity: number,
    location: string,
    cost?: number,
    quality?: InventoryLot["quality"],
    batch?: string,
  ) => void;
  transfer: (lot: InventoryLot, quantity: number, to: string) => void;
  command: (command: FactoryCommand) => void;
}
const ensure = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const finitePositive = (n: number) => Number.isFinite(n) && n > 0;
export class EnterpriseSystem {
  constructor(private h: Host) {}
  private get s() {
    return this.h.s;
  }
  private get e() {
    return this.s.enterprise;
  }
  private calendar() {
    if (!this.e.calendarActive) {
      this.e.calendarActive = true;
      this.h.schedule(
        "calendar",
        "calendar",
        (Math.floor(this.h.now / 3600) + 1) * 3600,
      );
    }
  }
  command(c: AdvancedCommand) {
    const { s, e, h } = this;
    switch (c.type) {
      case "zone": {
        ensure(s.world.owned, "Nejdříve kupte pozemek.");
        ensure(
          c.name.length > 0 &&
            c.name.length <= 80 &&
            [c.x, c.y, c.width, c.height].every(Number.isInteger) &&
            c.x >= 1 &&
            c.y >= 1 &&
            c.width >= 1 &&
            c.height >= 1 &&
            c.x + c.width < 99 &&
            c.y + c.height < 69 &&
            finitePositive(c.maxKg) &&
            finitePositive(c.maxM3),
          "Neplatná skladová zóna.",
        );
        const rect = { x: c.x, y: c.y, width: c.width, height: c.height };
        ensure(
          !e.zones.some((z) => overlap(rect, z)) &&
            !s.machines.some((m) => overlap(rect, footprint(s, m.id))),
          "Zóna koliduje s existující stavbou.",
        );
        ensure(
          path(s, { x: 2, y: 2 }, { x: c.x - 1, y: c.y }, rect) &&
            s.machines.every((m) =>
              path(s, { x: 2, y: 2 }, port(s, `${m.id}:in`), rect),
            ) &&
            e.zones.every((z) =>
              path(s, { x: 2, y: 2 }, { x: z.x - 1, y: z.y }, rect),
            ),
          "Zóna blokuje přístup.",
        );
        h.spend(c.width * c.height * 200000, "Skladové regály");
        e.zones.push({
          id: h.id("zone"),
          name: c.name,
          ...rect,
          maxKg: c.maxKg,
          maxM3: c.maxM3,
          kind: c.kind,
        });
        s.factory.revision++;
        break;
      }
      case "move": {
        const lot = s.lots.find((l) => l.id === c.lotId);
        ensure(
          lot &&
            finitePositive(c.quantity) &&
            c.quantity <= lot.quantity - lot.reserved - this.isAllocated(lot),
          "Neplatná přepravní dávka.",
        );
        ensure(
          c.to !== lot!.locationId &&
            accepts(s, c.to, lot!.itemId, c.quantity, lot!.quality),
          "Cílový sklad nemá kapacitu nebo správnou kategorii.",
        );
        ensure(
          path(s, port(s, lot!.locationId), port(s, c.to)),
          "Chybí průchozí trasa.",
        );
        h.transfer(lot!, c.quantity, c.to);
        break;
      }
      case "vehicle":
        ensure(s.world.owned, "Chybí pozemek.");
        ensure(
          c.kind === "forklift" ||
            e.research.some(
              (r) => r.id === "automation" && r.status === "done",
            ),
          "Nejdříve dokončete výzkum automatizace.",
        );
        h.spend(
          c.kind === "forklift" ? 250000000 : 450000000,
          "Manipulační vozidlo",
        );
        e.vehicles.push({
          id: h.id("vehicle"),
          kind: c.kind,
          capacityKg: c.kind === "forklift" ? 1500 : 500,
          speed: c.kind === "forklift" ? 2 : 1.2,
          width: c.kind === "forklift" ? 2 : 1,
          enabled: true,
        });
        break;
      case "dock":
        ensure(
          s.world.owned &&
            [c.x, c.y, c.openHour, c.closeHour].every(Number.isInteger) &&
            c.x >= 0 &&
            c.y >= 0 &&
            c.x < 100 &&
            c.y < 70 &&
            c.openHour >= 0 &&
            c.closeHour <= 24 &&
            c.openHour < c.closeHour,
          "Neplatná rampa nebo dodací okno.",
        );
        h.spend(50000000, "Rampa");
        e.docks.push({
          id: h.id("dock"),
          x: c.x,
          y: c.y,
          openHour: c.openHour,
          closeHour: c.closeHour,
          busyUntil: 0,
        });
        break;
      case "delivery-zone": {
        const d = s.factory.deliveries.find((d) => d.id === c.deliveryId);
        ensure(d, "Dodávka neexistuje.");
        ensure(
          e.zones.some((z) => z.id === c.zoneId) &&
            accepts(s, c.zoneId, d!.itemId, d!.quantity),
          "Sklad nemá dostatečnou fyzickou kapacitu.",
        );
        e.deliveryZones[d!.id] = c.zoneId;
        break;
      }
      case "plan": {
        const contract = s.factory.contracts.find(
          (cn) => cn.id === c.contractId && cn.status === "accepted",
        );
        ensure(contract, "Nejdříve přijměte zakázku.");
        ensure(
          !e.plans.some(
            (p) => p.contractId === c.contractId && p.status !== "done",
          ),
          "Zakázka již má výrobní příkaz.",
        );
        const productId = e.contractProducts[c.contractId] ?? "FE-HX001";
        const needs = mrp(s, contract!.quantity, productId, c.makeComponents);
        const cost = needs.reduce((n, row) => n + row.costMinor, 0);
        ensure(
          s.finance.cashMinor >= cost,
          "Nedostatek peněz na materiálový plán.",
        );
        const purchased: Record<string, number> = {};
        for (const row of needs) purchased[row.itemId] = row.shortage;
        const plan = {
          id: h.id("plan"),
          contractId: c.contractId,
          productId,
          quantity: contract!.quantity,
          status: "planned" as const,
          reservedLotIds: [] as string[],
          purchased,
        };
        // Allocate already present lots; these are business reservations, distinct from transport.
        for (const row of needs) {
          let remaining = row.required;
          for (const lot of s.lots) {
            if (
              lot.itemId !== row.itemId ||
              !storageLocation(lot.locationId) ||
              lot.quality !== "good"
            )
              continue;
            const amount = Math.min(
              remaining,
              lot.quantity -
                lot.reserved -
                e.allocations
                  .filter((a) => a.lotId === lot.id)
                  .reduce((n, a) => n + a.quantity, 0),
            );
            if (amount > 0) {
              e.allocations.push({
                lotId: lot.id,
                contractId: c.contractId,
                quantity: amount,
              });
              plan.reservedLotIds.push(lot.id);
              remaining -= amount;
            }
            if (remaining <= 0) break;
          }
        }
        e.plans.push(plan);
        break;
      }
      case "release-plan": {
        const p = e.plans.find(
          (p) => p.id === c.planId && p.status === "planned",
        );
        ensure(p, "Neexistující plán.");
        const quote = Object.entries(p!.purchased);
        ensure(
          s.finance.cashMinor >=
            quote.reduce(
              (n, [itemId, q]) =>
                n + Math.round(q * (PURCHASE_PRICES[itemId] ?? 0)),
              0,
            ),
          "Nedostatek hotovosti.",
        );
        ensure(
          quote.every(
            ([itemId, q]) =>
              PURCHASE_PRICES[itemId] !== undefined && q <= 10000,
          ) &&
            s.lots.reduce((n, l) => n + l.quantity, 0) +
              s.factory.deliveries.reduce((n, d) => n + d.quantity, 0) +
              quote.reduce((n, [, q]) => n + q, 0) <=
              s.factory.storageCapacity,
          "Materiálový plán přesahuje skladovou nebo dodavatelskou kapacitu.",
        );
        for (const [itemId, quantity] of quote)
          if (quantity > 0)
            h.command({
              type: "buy",
              itemId,
              quantity: Math.ceil(quantity * 1000) / 1000,
            });
        p!.status = "released"; // Allocate consumed lots to the plan until release, then production owns physical reservations.
        e.allocations = e.allocations.filter(
          (a) => a.contractId !== p!.contractId,
        );
        break;
      }
      case "framework": {
        ensure(
          Number.isInteger(c.quantity) &&
            c.quantity > 0 &&
            c.quantity <= 1000 &&
            Number.isInteger(c.months) &&
            c.months >= 1 &&
            c.months <= 36,
          "Rámcová smlouva musí mít 1–36 měsíců a 1–1000 ks měsíčně.",
        );
        const product = PRODUCTS.find((p) => p.id === c.productId);
        ensure(product, "Neznámý výrobek.");
        ensure(
          c.productId === "FE-HX001" ||
            e.research.some(
              (r) => r.id === "export-product" && r.status === "done",
            ),
          "Varianta není odemčená.",
        );
        e.frameworks.push({
          id: h.id("framework"),
          productId: c.productId,
          quantity: c.quantity,
          priceMinor: product!.unitPriceMinor,
          start: h.now,
          next: h.now + 30 * 86400,
          end: h.now + c.months * 30 * 86400,
          paymentDays: 30,
          active: true,
        });
        this.calendar();
        break;
      }
      case "quote": {
        const cst = s.factory.contracts.find(
          (contract) =>
            contract.id === c.contractId && contract.status === "offer",
        );
        ensure(
          cst &&
            Number.isSafeInteger(c.priceMinor) &&
            c.priceMinor > 0 &&
            !e.quotes[c.contractId],
          "Neplatná nebo již vyhodnocená nabídka.",
        );
        ensure(
          c.priceMinor >= cst!.unitPriceMinor * 0.8 &&
            c.priceMinor <= cst!.unitPriceMinor * 1.2,
          "Cena musí být v rozmezí ±20 % poptávky.",
        );
        s.rngState = (Math.imul(1664525, s.rngState) + 1013904223) >>> 0;
        const ceiling = Math.round(
            cst!.unitPriceMinor * (1 + (s.rngState % 8) / 100),
          ),
          accepted = c.priceMinor <= ceiling;
        e.quotes[c.contractId] = { priceMinor: c.priceMinor, accepted };
        if (accepted) {
          cst!.unitPriceMinor = c.priceMinor;
          cst!.status = "accepted";
          this.calendar();
        }
        break;
      }
      case "roster": {
        const m = s.factory.machines.find((m) => m.id === c.machineId);
        ensure(m && m.due === null, "Zastavte pracoviště před změnou týmu.");
        ensure(
          c.workerIds.length > 0 &&
            c.workerIds.length <= 20 &&
            new Set(c.workerIds).size === c.workerIds.length &&
            c.workerIds.every((id) =>
              s.employees.some((w) => w.id === id && productionRole(w.role)),
            ),
          "Neplatný tým operátorů.",
        );
        ensure(
          !Object.entries(e.rosters).some(
            ([id, roster]) =>
              id !== c.machineId && roster.some((w) => c.workerIds.includes(w)),
          ) &&
            !s.factory.machines.some(
              (other) =>
                other.id !== c.machineId &&
                other.workerId &&
                c.workerIds.includes(other.workerId),
            ),
          "Pracovník už obsluhuje jiný stroj.",
        );
        e.rosters[c.machineId] = [...c.workerIds];
        m!.workerId = c.workerIds[0]!;
        this.calendar();
        break;
      }
      case "market":
        if (!e.marketActive) {
          e.marketActive = true;
          h.schedule("market", "market", h.now + 7 * 86400);
        }
        this.offer();
        break;
      case "shift": {
        const w = s.employees.find((w) => w.id === c.workerId);
        ensure(w, "Pracovník neexistuje.");
        ensure(
          ["continuous", "morning", "afternoon", "night"].includes(c.shift),
          "Neplatná směna.",
        );
        const p = this.profile(w!.id);
        p.shift = c.shift;
        this.calendar();
        break;
      }
      case "train": {
        ensure(
          [
            "operation",
            "assembly",
            "quality",
            "CAB",
            "forklift",
            "maintenance",
          ].includes(c.skill),
          "Neznámá kvalifikace.",
        );
        const p = this.profile(c.workerId);
        ensure(
          p.trainingUntil <= h.now && !p.skills.includes(c.skill),
          "Pracovník se již školí nebo kvalifikaci má.",
        );
        ensure(
          !s.factory.machines.some(
            (m) => m.workerId === c.workerId && m.due !== null,
          ) && !s.factory.transfers.some((t) => t.workerId === c.workerId),
          "Pracovník právě vykonává úlohu.",
        );
        h.spend(1000000, "Školení", true);
        p.trainingUntil = h.now + 86400;
        p.trainingSkill = c.skill;
        h.schedule("training", c.workerId, p.trainingUntil);
        break;
      }
      case "absence": {
        ensure(
          Number.isInteger(c.days) && c.days >= 1 && c.days <= 30,
          "Absence 1–30 dní.",
        );
        ensure(
          !s.factory.machines.some(
            (m) => m.workerId === c.workerId && m.due !== null,
          ) && !s.factory.transfers.some((t) => t.workerId === c.workerId),
          "Pracovník dokončuje aktivní úlohu.",
        );
        this.profile(c.workerId).absenceUntil = h.now + c.days * 86400;
        this.calendar();
        break;
      }
      case "service": {
        const m = s.factory.machines.find((m) => m.id === c.machineId);
        ensure(
          m && Number.isInteger(c.intervalCycles) && c.intervalCycles >= 10,
          "Interval nejméně 10 cyklů.",
        );
        e.service[c.machineId] = {
          intervalCycles: c.intervalCycles,
          lastCycles: m!.completed + m!.rejected,
          lastFault: 0,
          failures: 0,
          repairSeconds: 0,
          scheduled: null,
          faultReason: "",
        };
        break;
      }
      case "preventive": {
        const m = s.factory.machines.find((m) => m.id === c.machineId);
        ensure(
          m && m.due === null,
          "Nejdříve zastavte stroj a dokončete cyklus.",
        );
        ensure(
          s.employees.filter(
            (w) =>
              w.role === "mechanic" &&
              onShift(s, w, h.now, 3600, "maintenance"),
          ).length > s.factory.events.filter((e) => e.kind === "repair").length,
          "Chybí kvalifikovaný údržbář na směně.",
        );
        const consumed = h.consume("SPARE", 1, "warehouse");
        s.finance.expensesMinor += consumed.cost;
        const placed = s.machines.find((m) => m.id === c.machineId)!;
        placed.status = "maintenance";
        recordState(s, m!.id, "maintenance", h.now);
        m!.reason = "Preventivní servis";
        if (e.service[m!.id]) e.service[m!.id]!.scheduled = h.now + 3600;
        h.schedule("repair", m!.id, h.now + 3600);
        break;
      }
      case "utility-source": {
        ensure(
          s.world.owned &&
            Number.isInteger(c.x) &&
            Number.isInteger(c.y) &&
            c.x >= 0 &&
            c.x < 100 &&
            c.y >= 0 &&
            c.y < 70 &&
            finitePositive(c.capacity) &&
            c.capacity <= 10000,
          "Neplatný zdroj média.",
        );
        h.spend(Math.round(c.capacity * 100000), "Zdroj média / rozvodna");
        if (c.kind === "power") s.factory.powerCapacityKw += c.capacity;
        e.utilities.push({
          id: h.id("utility"),
          kind: c.kind,
          x: c.x,
          y: c.y,
          capacity: c.capacity,
          enabled: true,
        });
        break;
      }
      case "utility-link": {
        const source = e.utilities.find((u) => u.id === c.sourceId),
          m = s.factory.machines.find((m) => m.id === c.machineId);
        ensure(source && m, "Chybí zdroj nebo stroj.");
        ensure(
          !e.links.some(
            (l) => l.machineId === c.machineId && l.kind === source!.kind,
          ),
          "Toto médium už je připojené.",
        );
        const route = path(
          s,
          { x: source!.x, y: source!.y },
          port(s, `${m!.id}:in`),
        );
        ensure(route, "Chybí průchozí trasa rozvodu.");
        h.spend(route!.length * 10000, "Rozvod média");
        e.links.push({
          machineId: m!.id,
          kind: source!.kind,
          sourceId: source!.id,
          path: route!,
        });
        if (source!.kind === "power" || source!.kind === "air")
          m![source!.kind] = true;
        break;
      }
      case "utility-toggle": {
        const source = e.utilities.find((u) => u.id === c.sourceId);
        ensure(source, "Neznámý zdroj.");
        ensure(
          !s.factory.machines.some(
            (m) =>
              m.due !== null &&
              e.links.some(
                (l) => l.machineId === m.id && l.sourceId === source!.id,
              ),
          ),
          "Zdroj zásobuje běžící cyklus; nejdříve výrobu zastavte.",
        );
        ensure(
          !s.factory.machines.some(
            (m) =>
              m.due !== null &&
              (source!.kind === "power" || source!.kind === "air") &&
              m[source!.kind] &&
              !e.links.some(
                (link) => link.machineId === m.id && link.kind === source!.kind,
              ),
          ),
          "Zdroj zásobuje běžící pracoviště.",
        );
        source!.enabled = c.enabled;
        break;
      }
      case "policy":
        ensure(
          ["localBrazing", "detailedUtilities", "autoService"].includes(c.key),
          "Neznámé pravidlo.",
        );
        e.policies[c.key] = c.enabled;
        if (c.key === "autoService") this.calendar();
        break;
      case "waste": {
        const lot = s.lots.find((l) => l.id === c.lotId);
        ensure(
          lot &&
            ["scrap", "quarantine"].includes(lot.quality) &&
            finitePositive(c.quantity) &&
            c.quantity <= lot.quantity - lot.reserved - this.isAllocated(lot),
          "Neplatný odpad nebo rezervovaná šarže.",
        );
        const metal = lot!.itemId.startsWith("SCRAP"),
          amount = Math.round(
            c.quantity * physical(lot!.itemId).kg * (metal ? 2000 : 500),
          );
        if (!metal) h.spend(amount, "Likvidace odpadu", true);
        else {
          s.finance.cashMinor += amount;
          s.finance.revenueMinor += amount;
        }
        const ratio = c.quantity / lot!.quantity;
        s.finance.expensesMinor += Math.round(lot!.costMinor * ratio);
        lot!.costMinor -= Math.round(lot!.costMinor * ratio);
        lot!.quantity = Math.round((lot!.quantity - c.quantity) * 1e6) / 1e6;
        s.lots = s.lots.filter((l) => l.quantity > 0);
        break;
      }
      case "research": {
        const r = RESEARCH.find((r) => r.id === c.researchId);
        ensure(
          r && !e.research.some((r) => r.id === c.researchId),
          "Neplatný nebo již zahájený výzkum.",
        );
        h.spend(r!.costMinor, "Výzkum", true);
        const due = h.now + r!.seconds;
        e.research.push({ id: r!.id, status: "running", due });
        h.schedule("research", r!.id, due);
        break;
      }
      case "robot": {
        ensure(
          e.research.some((r) => r.id === "automation" && r.status === "done"),
          "Nejdříve dokončete výzkum.",
        );
        const m = s.factory.machines.find((m) => m.id === c.machineId);
        ensure(
          m && m.due === null && !e.automatic.includes(m.id),
          "Stroj neexistuje, pracuje nebo je už robotizovaný.",
        );
        h.spend(200000000, "Robotizace pracoviště");
        e.automatic.push(m!.id);
        delete e.rosters[m!.id];
        m!.workerId = null;
        break;
      }
      case "conveyor": {
        ensure(
          e.research.some((r) => r.id === "automation" && r.status === "done"),
          "Nejdříve dokončete automatizaci.",
        );
        ensure(
          c.from !== c.to &&
            s.machines.some((m) => c.from === `${m.id}:out`) &&
            (storageLocation(c.to) ||
              s.machines.some((m) => c.to === `${m.id}:in`)),
          "Neplatné konce dopravníku.",
        );
        ensure(
          !e.conveyors.some((cv) => cv.from === c.from && cv.to === c.to),
          "Dopravník již existuje.",
        );
        const route = path(s, port(s, c.from), port(s, c.to));
        ensure(route, "Dopravník nemá průchozí trasu.");
        h.spend(route!.length * 500000, "Dopravník");
        e.conveyors.push({
          id: h.id("conveyor"),
          from: c.from,
          to: c.to,
          path: route!,
          enabled: true,
          speed: 0.5,
          capacityKg: 100,
        });
        break;
      }
      case "replenish":
        ensure(
          e.research.some((r) => r.id === "mes" && r.status === "done"),
          "Nejdříve dokončete MES.",
        );
        ensure(
          finitePositive(c.target) &&
            Number.isFinite(c.minimum) &&
            c.minimum >= 0 &&
            c.target > c.minimum &&
            c.target <= 10000,
          "Neplatné minimum/cíl.",
        );
        {
          const existing = e.replenish.find((r) => r.itemId === c.itemId);
          if (existing) Object.assign(existing, c);
          else
            e.replenish.push({
              itemId: c.itemId,
              minimum: c.minimum,
              target: c.target,
              enabled: c.enabled,
            });
          this.calendar();
        }
        break;
    }
  }
  private profile(id: string) {
    const worker = this.s.employees.find((w) => w.id === id);
    ensure(worker, "Pracovník neexistuje.");
    return (
      this.e.workerProfiles[id] ??
      (this.e.workerProfiles[id] = {
        shift: "continuous",
        skills:
          worker!.role === "mechanic"
            ? ["maintenance"]
            : worker!.role === "warehouse"
              ? ["forklift"]
              : ["operation", "assembly", "quality"],
        trainingUntil: 0,
        trainingSkill: null,
        absenceUntil: 0,
      })
    );
  }
  private offer() {
    const { s, h } = this;
    if (
      s.factory.contracts.filter(
        (c) => c.status === "offer" && c.deadline >= h.now,
      ).length >= 6
    )
      return;
    s.rngState = (Math.imul(1664525, s.rngState) + 1013904223) >>> 0;
    const variant =
      this.e.research.some(
        (r) => r.id === "export-product" && r.status === "done",
      ) && s.rngState % 2 === 0;
    const product = PRODUCTS[variant ? 1 : 0]!;
    const id = h.id("contract");
    s.factory.contracts.push({
      id,
      quantity: 10 + (s.rngState % 91),
      unitPriceMinor: product.unitPriceMinor + ((s.rngState >>> 8) % 10000),
      deadline: h.now + 30 * 86400,
      paymentDays: [14, 30, 60][s.rngState % 3]!,
      status: "offer",
    });
    this.e.contractProducts[id] = product.id;
  }
  event(event: ScheduledEvent): boolean {
    const { h, s, e } = this;
    switch (event.kind) {
      case "training": {
        const p = e.workerProfiles[event.id];
        if (p?.trainingSkill && p.trainingUntil === event.at) {
          p.skills.push(p.trainingSkill);
          p.trainingSkill = null;
          p.trainingUntil = 0;
        }
        return true;
      }
      case "research": {
        const r = e.research.find((r) => r.id === event.id);
        if (r) r.status = "done";
        return true;
      }
      case "changeover": {
        const placed = s.machines.find((m) => m.id === event.id);
        if (placed) placed.status = "idle";
        return true;
      }
      case "market":
        this.offer();
        h.schedule("market", "market", h.now + 7 * 86400);
        return true;
      case "calendar": {
        this.compactHistory();
        for (const fw of e.frameworks) {
          if (fw.active && fw.next <= h.now && fw.next <= fw.end) {
            const id = h.id("calloff");
            s.factory.contracts.push({
              id,
              quantity: fw.quantity,
              unitPriceMinor: fw.priceMinor,
              deadline: fw.next + 29 * 86400,
              paymentDays: fw.paymentDays,
              status: "accepted",
            });
            e.contractProducts[id] = fw.productId;
            fw.next += 30 * 86400;
            if (fw.next > fw.end) fw.active = false;
          }
        }
        for (const c of s.factory.contracts) {
          if (c.status !== "accepted" || h.now <= c.deadline) continue;
          const days = Math.floor((h.now - c.deadline) / 86400),
            previous = e.penalties[c.id] ?? 0;
          if (days > previous) {
            const fee =
              (days - previous) *
              Math.round(c.quantity * c.unitPriceMinor * 0.005);
            const paid = Math.min(s.finance.cashMinor, fee);
            s.finance.cashMinor -= paid;
            s.finance.expensesMinor += fee;
            s.finance.payablesMinor += fee - paid;
            e.penalties[c.id] = days;
          }
        }
        for (const rule of e.replenish.filter((r) => r.enabled)) {
          const available =
            s.lots
              .filter(
                (l) =>
                  storageLocation(l.locationId) &&
                  l.itemId === rule.itemId &&
                  l.quality === "good",
              )
              .reduce((n, l) => n + l.quantity - l.reserved, 0) +
            s.factory.deliveries
              .filter((d) => d.itemId === rule.itemId)
              .reduce((n, d) => n + d.quantity, 0);
          if (available < rule.minimum) {
            try {
              h.command({
                type: "buy",
                itemId: rule.itemId,
                quantity: Math.ceil((rule.target - available) * 1000) / 1000,
              });
            } catch {
              /* Shortage remains visible and retries next planning hour. */
            }
          }
        }
        if (e.policies.autoService)
          for (const [id, service] of Object.entries(e.service)) {
            const m = s.factory.machines.find((m) => m.id === id),
              placed = s.machines.find((m) => m.id === id);
            if (
              m &&
              placed &&
              m.due === null &&
              m.completed + m.rejected - service.lastCycles >=
                service.intervalCycles &&
              placed.status !== "maintenance"
            ) {
              try {
                this.command({ type: "preventive", machineId: id });
              } catch {
                /* Available mechanic and spare are hard prerequisites. */
              }
            }
          }
        const day = Math.floor(h.now / 86400);
        if (e.reports.at(-1)?.day !== day) {
          const r = financialReport(s);
          e.reports.push({
            day,
            cashMinor: s.finance.cashMinor,
            revenueMinor: s.finance.revenueMinor,
            expensesMinor: s.finance.expensesMinor,
            inventoryMinor: r.inventoryMinor,
            shipped: s.factory.shipped,
          });
          if (e.reports.length > 366) e.reports.shift();
        }
        h.schedule("calendar", "calendar", h.now + 3600);
        return true;
      }
      default:
        return false;
    }
  }
  deliveryTime(due: number, deliveryId?: string): number {
    const docks = this.e.docks;
    if (!docks.length) return due;
    const candidates = docks
      .map((d) => {
        let at = Math.max(due, d.busyUntil);
        const day = Math.floor(at / 86400) * 86400,
          hour = (at % 86400) / 3600;
        if (hour < d.openHour) at = day + d.openHour * 3600;
        else if (hour >= d.closeHour) at = day + 86400 + d.openHour * 3600;
        return { dock: d, at };
      })
      .sort((a, b) => a.at - b.at);
    const first = candidates[0]!;
    first.dock.busyUntil = first.at + 900;
    if (deliveryId) this.e.deliveryDocks[deliveryId] = first.dock.id;
    return first.at;
  }
  // Hooks shared by event-driven production and the advanced modules.
  compactHistory(): void {
    const e = this.e;
    if (e.genealogy.length <= 5000 && e.inspections.length <= 2000) return;
    e.inspections = e.inspections.slice(-1000);
    const nodes = new Map(e.genealogy.map((b) => [b.id, b])),
      keep = new Set<string>(),
      pending = [
        ...this.s.lots.map((l) => l.batchId),
        ...this.s.factory.machines.flatMap((m) => m.cycleBatchIds),
        ...this.s.factory.cooperations.map((c) => c.batchId),
        ...e.inspections.map((i) => i.batchId),
        ...e.genealogy.slice(-2000).map((b) => b.id),
      ];
    while (pending.length) {
      const id = pending.pop()!;
      if (keep.has(id)) continue;
      keep.add(id);
      const node = nodes.get(id);
      if (node) pending.push(...node.parents);
    }
    e.genealogy = e.genealogy.filter((b) => keep.has(b.id));
  }
  beforeRepair(id: string) {
    const service = this.e.service[id];
    if (service) {
      if (service.lastFault > 0)
        service.repairSeconds += Math.max(0, this.h.now - service.lastFault);
      service.lastFault = 0;
      service.lastCycles =
        this.s.factory.machines.find((m) => m.id === id)!.completed +
        this.s.factory.machines.find((m) => m.id === id)!.rejected;
      service.scheduled = null;
    }
  }
  completed(id: string, ideal: number, passed: boolean) {
    recordState(this.s, id, "running", this.h.now);
    const metric = this.e.metrics[id]!;
    metric.cycles++;
    metric.good += passed ? 1 : 0;
    metric.idealSeconds += ideal;
  }
  isAllocated(lot: InventoryLot) {
    return this.e.allocations
      .filter((a) => a.lotId === lot.id)
      .reduce((n, a) => n + a.quantity, 0);
  }
  trafficStart(route: Point[], now: number): number {
    let start = now;
    if (!this.e.policies.traffic) return start;
    const cells = new Set(route.map((p) => p.x + "," + p.y));
    for (const t of this.s.factory.transfers) {
      if (t.started === null || t.due === null) continue;
      if (t.path.some((p) => cells.has(p.x + "," + p.y)))
        start = Math.max(start, t.due);
    }
    return start;
  }
}
