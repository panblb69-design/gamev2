import { ROLES, productionRole, type EmployeeRole } from "../workforce/roles";
import type { UtilityKind } from "../infrastructure/networks";
import { EnterpriseSystem, type AdvancedCommand } from "../enterprise/system";
import {
  InventoryIndex,
  storageLocation,
  physical,
  accepts,
} from "../logistics/warehouse";
import { onShift, requiredSkill, nextShift } from "../workforce/calendar";
import { demands, utilityReady } from "../infrastructure/networks";
import { recordState } from "../analytics/metrics";
import { GAME_SECONDS_PER_TICK } from "../core/time";
import type { GameState, InventoryLot } from "../core/model";
import { machines, items } from "../data/catalog";
import { OPERATIONS, COSTS, PURCHASE_PRICES } from "./catalog";
import type { Rect, ProductionMachine, ScheduledEvent } from "./model";
import {
  contains,
  footprint,
  overlap,
  path,
  widePath,
  port,
  warehouse,
} from "../world/path";
import { push, pop } from "./queue";
type BasicCommand =
  | { type: "buy-land" }
  | { type: "build-hall"; rect: Rect }
  | {
      type: "place";
      definitionId: string;
      x: number;
      y: number;
      orientation: 0 | 90;
    }
  | { type: "connect"; machineId: string; utility: "power" | "air" }
  | { type: "hire"; role: EmployeeRole }
  | { type: "configure"; machineId: string; recipeId: string; enabled: boolean }
  | { type: "assign"; machineId: string; workerId: string }
  | { type: "buy"; itemId: string; quantity: number }
  | { type: "cooperate"; quantity: number }
  | { type: "accept"; contractId: string }
  | { type: "ship"; contractId: string }
  | { type: "repair"; machineId: string };
export type FactoryCommand = BasicCommand | AdvancedCommand;
const ADVANCED = new Set([
  "zone",
  "move",
  "vehicle",
  "dock",
  "delivery-zone",
  "plan",
  "release-plan",
  "framework",
  "market",
  "shift",
  "train",
  "absence",
  "service",
  "preventive",
  "utility-source",
  "utility-link",
  "utility-toggle",
  "policy",
  "waste",
  "research",
  "robot",
  "conveyor",
  "replenish",
  "quote",
  "roster",
]);
const round = (n: number) => Math.round(n * 1e6) / 1e6;
export class FactoryEngine {
  private now: number;
  private dirty: Set<string> | null = null;
  private index: InventoryIndex | null = null;
  private changedItem(itemId: string, location: string) {
    if (this.dirty === null) return;
    if (storageLocation(location)) {
      for (const m of this.f.machines) {
        if (
          OPERATIONS.find((r) => r.id === m.recipeId)?.inputs.some(
            (i) => i.itemId === itemId,
          )
        )
          this.dirty.add(m.id);
      }
    } else this.dirty.add(location.split(":")[0]!);
  }

  private get inventory() {
    return this.index ?? (this.index = new InventoryIndex(this.s.lots));
  }
  private invalidate() {
    this.index = null;
  }
  private get advanced() {
    return new EnterpriseSystem({
      s: this.s,
      now: this.now,
      id: (p) => this.id(p),
      schedule: (k, id, at) => this.schedule(k, id, at),
      spend: (n, k, e) => this.spend(n, k, e),
      consume: (i, q, l) => this.consume(i, q, l),
      addLot: (i, q, l, c, quality, b) => this.addLot(i, q, l, c, quality, b),
      transfer: (l, q, to) => this.createTransfer(l, q, to),
      command: (c) => this.command(`internal-${this.f.nextId}`, c, true),
    });
  }

  constructor(public s: GameState) {
    this.now = s.tick * GAME_SECONDS_PER_TICK;
  }
  private get f() {
    return this.s.factory;
  }
  private id(prefix: string) {
    return `${prefix}-${this.f.nextId++}`;
  }
  private schedule(kind: ScheduledEvent["kind"], id: string, at: number) {
    push(this.f.events, { kind, id, at, seq: this.f.eventSeq++ });
  }
  private log(kind: string, amountMinor: number) {
    this.f.ledger.push({ at: this.now, kind, amountMinor });
    if (this.f.ledger.length > 200) this.f.ledger.shift();
  }
  private spend(amount: number, kind: string, expense = false) {
    if (
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      this.s.finance.cashMinor < amount
    )
      throw new Error("Nedostatek hotovosti.");
    this.s.finance.cashMinor -= amount;
    if (expense) this.s.finance.expensesMinor += amount;
    this.log(kind, -amount);
  }
  private addLot(
    itemId: string,
    quantity: number,
    locationId: string,
    costMinor = 0,
    quality: InventoryLot["quality"] = "good",
    batchId = this.id("batch"),
  ) {
    if (quantity <= 0) return;
    const kg = physical(itemId).kg,
      kind =
        items.find((i) => i.id === itemId)?.kind === "medium"
          ? "tank"
          : kg * quantity > 30
            ? "pallet"
            : "bin",
      maxKg = kind === "tank" ? 10000 : kind === "pallet" ? 1500 : 30;
    if (quantity * kg > maxKg + 1e-6) {
      let remaining = quantity,
        cost = costMinor;
      while (remaining > 1e-7) {
        const take = Math.min(remaining, maxKg / kg),
          value =
            take === remaining
              ? cost
              : Math.round((costMinor * take) / quantity);
        this.addLot(itemId, take, locationId, value, quality, batchId);
        remaining = round(remaining - take);
        cost -= value;
      }
      return;
    }
    this.changedItem(itemId, locationId);
    const containerKind =
      items.find((i) => i.id === itemId)?.kind === "medium"
        ? "tank"
        : physical(itemId).kg * quantity > 30
          ? "pallet"
          : "bin";
    const existing = this.s.lots.find(
      (l) =>
        l.itemId === itemId &&
        l.locationId === locationId &&
        l.quality === quality &&
        l.batchId === batchId &&
        (l.quantity + quantity) * kg <= maxKg + 1e-6,
    );
    if (existing) {
      existing.quantity = round(existing.quantity + quantity);
      existing.costMinor += costMinor;
      return;
    }
    const lot: InventoryLot = {
      id: this.id("lot"),
      itemId,
      quantity: round(quantity),
      reserved: 0,
      locationId,
      quality,
      batchId,
      costMinor,
    };
    this.s.lots.push(lot);
    this.index?.add(lot);
    this.s.enterprise.containers.push({
      id: this.id("container"),
      lotId: lot.id,
      kind: containerKind,
      maxKg:
        containerKind === "bin"
          ? 30
          : containerKind === "pallet"
            ? 1500
            : 10000,
    });
    if (!this.s.enterprise.genealogy.some((b) => b.id === batchId))
      this.s.enterprise.genealogy.push({
        id: batchId,
        parents: [],
        itemId,
        quantity,
        at: this.now,
        recipeId: "receipt",
        quality:
          quality === "good"
            ? "good"
            : quality === "quarantine"
              ? "quarantine"
              : "scrap",
      });
  }
  stock(itemId: string, location = "warehouse"): number {
    if (location === "warehouse")
      return round(
        this.inventory
          .stored(itemId)
          .filter((l) => l.quality === "good")
          .reduce(
            (n, l) =>
              n + l.quantity - l.reserved - this.advanced.isAllocated(l),
            0,
          ),
      );
    return round(this.inventory.stock(itemId, location));
  }
  private cleanup() {
    this.s.lots = this.s.lots.filter((l) => l.quantity > 1e-7);
    const ids = new Set(this.s.lots.map((l) => l.id));
    this.s.enterprise.containers = this.s.enterprise.containers.filter((c) =>
      ids.has(c.lotId),
    );
    this.s.enterprise.allocations = this.s.enterprise.allocations.filter((a) =>
      ids.has(a.lotId),
    );
  }
  private consume(
    itemId: string,
    quantity: number,
    location: string,
    clean = true,
  ): { cost: number; batches: string[] } {
    if (this.stock(itemId, location) + 1e-7 < quantity)
      throw new Error("Chybí materiál.");
    let left = quantity,
      cost = 0;
    const batches: string[] = [];
    for (const lot of location === "warehouse"
      ? this.inventory.stored(itemId)
      : this.inventory.list(itemId, location)) {
      if (
        lot.itemId !== itemId ||
        (location === "warehouse"
          ? !storageLocation(lot.locationId)
          : lot.locationId !== location) ||
        lot.quality !== "good"
      )
        continue;
      const take = Math.min(
        left,
        lot.quantity - lot.reserved - this.advanced.isAllocated(lot),
      );
      if (take <= 0) continue;
      const value = Math.round((lot.costMinor * take) / lot.quantity);
      cost += value;
      lot.costMinor -= value;
      lot.quantity = round(lot.quantity - take);
      left = round(left - take);
      batches.push(lot.batchId);
      if (left <= 1e-7) break;
    }
    if (clean) this.cleanup();
    return { cost, batches };
  }
  private machine(id: string): ProductionMachine {
    const m = this.f.machines.find((m) => m.id === id);
    if (!m) throw new Error("Neznámý stroj.");
    return m;
  }
  command(commandId: string, c: FactoryCommand, internal = false): void {
    this.invalidate();
    if (!commandId || commandId.length > 150)
      throw new Error("Neplatné ID příkazu.");
    if (!internal && this.f.processedCommands.includes(commandId)) return;
    if (!internal && this.f.processedCommands.length >= 10000)
      throw new Error("Dosažen limit příkazů tohoto save. Exportujte hru.");
    if (ADVANCED.has(c.type)) {
      this.advanced.command(c as AdvancedCommand);
      if (!internal) this.f.processedCommands.push(commandId);
      this.reconcile();
      return;
    }
    switch (c.type) {
      case "buy-land":
        if (this.s.world.owned) throw new Error("Pozemek již vlastníte.");
        this.spend(COSTS.land, "Pozemek");
        this.s.world.owned = true;
        break;
      case "build-hall": {
        if (!this.s.world.owned || this.f.hall)
          throw new Error("Kupte pozemek; v M1 lze postavit jednu halu.");
        const r = c.rect;
        if (
          ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
          r.width < 10 ||
          r.height < 10 ||
          r.x < 4 ||
          r.y < 4 ||
          r.x + r.width > 99 ||
          r.y + r.height > 69
        )
          throw new Error(
            "Neplatný obdélník haly (min. 10 × 10 m, okraj 4 m).",
          );
        this.spend(r.width * r.height * COSTS.hallPerM2, "Stavba haly");
        this.f.hall = { ...r };
        this.f.revision++;
        break;
      }
      case "place": {
        const d = machines.find((m) => m.id === c.definitionId),
          h = this.f.hall;
        if (!h || !d || !OPERATIONS.some((r) => r.machineId === d.id))
          throw new Error("Stroj není dostupný nebo chybí hala.");
        if (
          !Number.isInteger(c.x) ||
          !Number.isInteger(c.y) ||
          ![0, 90].includes(c.orientation)
        )
          throw new Error("Neplatná pozice.");
        const r = {
          x: c.x,
          y: c.y,
          width: c.orientation === 90 ? d.footprint.height : d.footprint.width,
          height: c.orientation === 90 ? d.footprint.width : d.footprint.height,
        };
        if (
          !contains(h, r) ||
          !contains(h, { x: r.x + r.width - 1, y: r.y + r.height - 1 })
        )
          throw new Error("Stroj musí být uvnitř haly.");
        const service = {
          x: r.x - 1,
          y: r.y - 1,
          width: r.width + 2,
          height: r.height + 2,
        };
        if (
          this.s.enterprise.zones.some((z) => overlap(service, z)) ||
          this.s.machines.some((m) => overlap(service, footprint(this.s, m.id)))
        )
          throw new Error("Kolize nebo nedostatečná servisní ulička.");
        const p = { x: r.x - 1, y: r.y };
        if (
          !path(this.s, warehouse, p, r) ||
          this.s.machines.some(
            (m) => !path(this.s, warehouse, port(this.s, `${m.id}:in`), r),
          )
        )
          throw new Error("Umístění blokuje přístup skladu ke stroji.");
        this.spend(d.priceMinor, "Nákup stroje");
        const id = this.id("machine");
        this.s.machines.push({
          id,
          definitionId: d.id,
          x: c.x,
          y: c.y,
          orientation: c.orientation,
          status: "waiting_for_utilities",
          condition: 1,
        });
        this.f.machines.push({
          id,
          recipeId: OPERATIONS.find((r) => r.machineId === d.id)!.id,
          enabled: false,
          power: false,
          air: false,
          workerId: null,
          due: null,
          reason: "Připojte elektřinu a vzduch.",
          completed: 0,
          rejected: 0,
          inputCapacity: 5000,
          outputCapacity: 120,
          powerPath: [],
          cycleCostMinor: 0,
          cycleBatchIds: [],
        });
        this.s.enterprise.service[id] = {
          intervalCycles: 500,
          lastCycles: 0,
          lastFault: 0,
          failures: 0,
          repairSeconds: 0,
          scheduled: null,
          faultReason: "",
        };
        this.f.revision++;
        break;
      }
      case "connect": {
        const m = this.machine(c.machineId);
        if (m[c.utility]) throw new Error("Přípojka již existuje.");
        const route = path(this.s, warehouse, port(this.s, `${m.id}:in`));
        if (!route) throw new Error("Chybí přístupná trasa přípojky.");
        this.spend(
          c.utility === "power" ? COSTS.powerConnection : COSTS.airConnection,
          "Přípojka",
        );
        m[c.utility] = true;
        if (c.utility === "power") m.powerPath = route;
        break;
      }
      case "hire": {
        if (!this.s.world.owned) throw new Error("Nejdříve kupte pozemek.");
        if (!Object.hasOwn(ROLES, c.role)) throw new Error("Neznámá profese.");
        this.spend(COSTS.hire, "Nábor", true);
        this.s.employees.push({
          id: this.id("worker"),
          role: c.role,
          skills:
            c.role === "operator"
              ? ["operátor", "montážník", "kontrolor", "balič"]
              : [],
          wageMinor: ROLES[c.role].wageMinor,
          shiftId: "continuous",
          available: true,
        });
        if (!["operator", "warehouse", "mechanic"].includes(c.role)) {
          const worker = this.s.employees.at(-1)!;
          this.s.enterprise.workerProfiles[worker.id] = {
            shift: "continuous",
            skills: [...ROLES[c.role].skills],
            trainingUntil: 0,
            trainingSkill: null,
            absenceUntil: 0,
          };
        }
        if (!this.f.events.some((e) => e.kind === "payroll"))
          this.schedule(
            "payroll",
            "daily",
            (Math.floor(this.now / 86400) + 1) * 86400,
          );
        break;
      }
      case "assign": {
        const m = this.machine(c.machineId);
        if (m.due !== null) throw new Error("Počkejte na dokončení cyklu.");
        const worker = this.s.employees.find(
          (w) => w.id === c.workerId && productionRole(w.role),
        );
        if (
          !worker ||
          Object.entries(this.s.enterprise.rosters).some(
            ([id, roster]) => id !== m.id && roster.includes(c.workerId),
          ) ||
          this.f.machines.some(
            (other) => other.id !== m.id && other.workerId === worker.id,
          )
        )
          throw new Error("Operátor není dostupný.");
        m.workerId = worker.id;
        break;
      }
      case "configure": {
        const m = this.machine(c.machineId),
          placed = this.s.machines.find((i) => i.id === m.id)!;
        if (m.due !== null && c.recipeId !== m.recipeId)
          throw new Error("Změna receptu až po dokončení cyklu.");
        if (
          !OPERATIONS.some(
            (r) => r.id === c.recipeId && r.machineId === placed.definitionId,
          )
        )
          throw new Error("Nepodporovaná receptura.");
        if (
          m.recipeId !== c.recipeId &&
          (this.s.lots.some((l) => l.locationId === `${m.id}:in`) ||
            this.f.transfers.some((t) => t.to === `${m.id}:in`))
        )
          throw new Error(
            "Před změnou receptu vyčkejte na vyprázdnění vstupů.",
          );
        if (
          c.recipeId === "pack-export" &&
          !this.s.enterprise.research.some(
            (r) => r.id === "export-product" && r.status === "done",
          )
        )
          throw new Error("Varianta není odemčená výzkumem.");
        if (m.recipeId !== c.recipeId) {
          placed.status = "changeover";
          recordState(this.s, m.id, "changeover", this.now);
          m.reason = "Přestavba a výměna nástroje (30 min).";
          this.spend(50000, "Přestavba", true);
          this.schedule("changeover", m.id, this.now + 1800);
        }

        m.recipeId = c.recipeId;
        m.enabled = c.enabled;
        break;
      }
      case "buy": {
        if (!this.s.world.owned) throw new Error("Nejdříve kupte pozemek.");
        const price = PURCHASE_PRICES[c.itemId];
        if (
          price === undefined ||
          !Number.isFinite(c.quantity) ||
          c.quantity <= 0 ||
          c.quantity > 10000 ||
          !Number.isInteger(c.quantity * 1000)
        )
          throw new Error("Neplatné množství nebo položka.");
        if (
          this.s.lots.reduce((n, l) => n + l.quantity, 0) +
            this.f.deliveries.reduce((n, d) => n + d.quantity, 0) +
            c.quantity >
          this.f.storageCapacity
        )
          throw new Error("Nedostatečná kapacita skladu.");
        const cost = Math.round(price * c.quantity);
        this.spend(cost, "Objednávka materiálu");
        let supplierDelay = 0;
        if (this.s.enterprise.marketActive) {
          this.s.rngState =
            (Math.imul(1664525, this.s.rngState) + 1013904223) >>> 0;
          if (this.s.rngState % 10 === 0) supplierDelay = 8 * 3600;
        }
        const id = this.id("delivery"),
          due = this.advanced.deliveryTime(
            this.now + COSTS.deliverySeconds + supplierDelay,
            id,
          );
        this.f.deliveries.push({
          id,
          itemId: c.itemId,
          quantity: c.quantity,
          costMinor: cost,
          due,
        });
        this.schedule("delivery", id, due);
        break;
      }
      case "cooperate": {
        if (
          !Number.isInteger(c.quantity) ||
          c.quantity <= 0 ||
          c.quantity > 1000 ||
          this.stock("W001") < c.quantity
        )
          throw new Error("Chybí sestavená jádra ve skladu.");
        this.spend(
          c.quantity * COSTS.cooperationPerCore,
          "Tavidlo + CAB v kooperaci",
        );
        const consumed = this.consume("W001", c.quantity, "warehouse");
        const id = this.id("cooperation"),
          due = this.now + COSTS.cooperationSeconds;
        const cooperativeBatch = this.id("batch");
        this.s.enterprise.genealogy.push({
          id: cooperativeBatch,
          parents: consumed.batches,
          itemId: "W004",
          quantity: c.quantity,
          at: due,
          recipeId: "external-flux-cab",
          quality: "good",
        });
        this.f.cooperations.push({
          id,
          quantity: c.quantity,
          due,
          batchId: cooperativeBatch,
          costMinor: consumed.cost + c.quantity * COSTS.cooperationPerCore,
        });
        this.schedule("cooperation", id, due);
        break;
      }
      case "repair": {
        const m = this.machine(c.machineId),
          placed = this.s.machines.find((x) => x.id === m.id)!;
        if (placed.status !== "fault" || m.due !== null)
          throw new Error("Stroj není v poruše.");
        if (
          this.s.employees.filter(
            (w) =>
              (w.role === "mechanic" || w.role === "technician") &&
              onShift(this.s, w, this.now, 3600, "maintenance"),
          ).length <= this.f.events.filter((e) => e.kind === "repair").length
        )
          throw new Error("Chybí volný údržbář.");
        const consumed = this.consume("SPARE", 1, "warehouse");
        this.s.finance.expensesMinor += consumed.cost;
        placed.status = "maintenance";
        recordState(this.s, m.id, "maintenance", this.now);
        m.reason = "Probíhá oprava (1 hodina).";
        this.schedule("repair", m.id, this.now + 3600);
        break;
      }
      case "accept": {
        const contract = this.f.contracts.find(
          (x) => x.id === c.contractId && x.status === "offer",
        );
        if (!contract) throw new Error("Zakázka není dostupná.");
        if (this.now > contract.deadline)
          throw new Error("Termín zakázky již vypršel.");
        contract.status = "accepted";
        if (!this.s.enterprise.calendarActive) {
          this.s.enterprise.calendarActive = true;
          this.schedule(
            "calendar",
            "calendar",
            (Math.floor(this.now / 3600) + 1) * 3600,
          );
        }
        break;
      }
      case "ship": {
        const contract = this.f.contracts.find(
          (x) => x.id === c.contractId && x.status === "accepted",
        );
        const productId = contract
          ? (this.s.enterprise.contractProducts[contract.id] ?? "FE-HX001")
          : "FE-HX001";
        if (!contract || this.stock(productId) < contract.quantity)
          throw new Error("Chybí přijatá zakázka nebo dobré zabalené kusy.");
        this.spend(contract.quantity * COSTS.shippingPerUnit, "Expedice", true);
        const consumed = this.consume(
          productId,
          contract.quantity,
          "warehouse",
        );
        this.s.finance.expensesMinor += consumed.cost;
        const amount = contract.unitPriceMinor * contract.quantity;
        this.s.finance.revenueMinor += amount;
        this.s.finance.receivablesMinor += amount;
        contract.status = "shipped";
        const id = this.id("invoice"),
          due = this.now + contract.paymentDays * 86400;
        this.f.invoices.push({
          id,
          contractId: contract.id,
          quantity: contract.quantity,
          amountMinor: amount,
          due,
          paid: false,
        });
        this.f.shipped += contract.quantity;
        this.s.enterprise.plans
          .filter((p) => p.contractId === contract.id)
          .forEach((p) => (p.status = "done"));
        this.schedule("payment", id, due);
        this.log("Vystavena faktura (bez inkasa)", 0);
        break;
      }
    }
    if (!internal) this.f.processedCommands.push(commandId);
    this.reconcile();
  }
  private createTransfer(lot: InventoryLot, quantity: number, to: string) {
    if (to === "warehouse") {
      const candidates = this.s.enterprise.zones.filter((z) =>
        accepts(this.s, z.id, lot.itemId, quantity, lot.quality),
      );
      if (candidates.length) to = candidates[0]!.id;
    }
    if (
      storageLocation(to) &&
      !accepts(this.s, to, lot.itemId, quantity, lot.quality)
    )
      return;
    // Partial handling units cap task mass; remaining material stays reserved only when queued.
    const maxKg = Math.max(
      30,
      ...this.s.enterprise.vehicles
        .filter((v) => v.enabled)
        .map((v) => v.capacityKg),
    );
    quantity = round(
      Math.min(
        quantity,
        (Math.max(0, 5000 - this.f.transfers.length) * maxKg) /
          physical(lot.itemId).kg,
      ),
    );
    if (quantity <= 0) return;
    if (to === "warehouse") {
      const used =
        this.s.lots
          .filter((l) => l.locationId === "warehouse")
          .reduce((n, l) => n + l.quantity, 0) +
        this.f.transfers
          .filter((t) => t.to === "warehouse")
          .reduce((n, t) => n + t.quantity, 0) +
        this.f.deliveries.reduce((n, d) => n + d.quantity, 0);
      if (used + quantity > this.f.storageCapacity) return;
    }
    const route = path(this.s, port(this.s, lot.locationId), port(this.s, to));
    if (!route) return;
    lot.reserved = round(lot.reserved + quantity);
    let remaining = quantity;
    while (remaining > 1e-7) {
      const amount = Math.min(remaining, maxKg / physical(lot.itemId).kg),
        taskId = this.id("transfer");
      remaining = round(remaining - amount);
      this.f.transfers.push({
        id: taskId,
        lotId: lot.id,
        quantity: amount,
        from: lot.locationId,
        to,
        path: route,
        started: null,
        due: null,
        workerId: null,
      });
      this.s.enterprise.transport.push({
        taskId,
        vehicleId: null,
        notBefore: 0,
        mode: "manual",
      });
    }
  }
  private dispatch() {
    const busyWorkers = new Set(
      this.f.transfers.filter((t) => t.started !== null).map((t) => t.workerId),
    );
    const activeTasks = new Set(
      this.f.transfers.filter((t) => t.started !== null).map((t) => t.id),
    );
    const busyVehicles = new Set(
      this.s.enterprise.transport
        .filter((meta) => activeTasks.has(meta.taskId))
        .map((meta) => meta.vehicleId),
    );
    const availableWorkers = this.s.employees.filter(
      (w) =>
        w.role === "warehouse" &&
        onShift(this.s, w, this.now) &&
        !busyWorkers.has(w.id),
    );
    for (const task of this.f.transfers.filter((t) => t.started === null)) {
      if (
        !availableWorkers.length &&
        !this.s.enterprise.vehicles.some(
          (v) => v.enabled && v.kind === "agv" && !busyVehicles.has(v.id),
        ) &&
        !this.s.enterprise.conveyors.some(
          (c) => c.enabled && c.from === task.from && c.to === task.to,
        )
      )
        continue;
      const lot = this.inventory.lot(task.lotId);
      if (!lot) continue;
      const meta = this.s.enterprise.transport.find(
        (t) => t.taskId === task.id,
      ) ?? {
        taskId: task.id,
        vehicleId: null,
        notBefore: 0,
        mode: "manual" as const,
      };
      if (!this.s.enterprise.transport.some((t) => t.taskId === task.id))
        this.s.enterprise.transport.push(meta);
      const conveyor = this.s.enterprise.conveyors.find(
        (c) => c.enabled && c.from === task.from && c.to === task.to,
      );
      let transportCost = 0;
      let speed = 0.5,
        vehicleId: string | null = null,
        workerId: string | null = null,
        mode: "manual" | "forklift" | "agv" | "conveyor" = "manual";
      const weight = task.quantity * physical(lot.itemId).kg;
      if (
        (conveyor || vehicleId) &&
        !this.s.enterprise.utilities.some(
          (u) => u.kind === "power" && u.enabled,
        )
      )
        continue;
      if (conveyor && weight <= conveyor.capacityKg) {
        mode = "conveyor";
        speed = conveyor.speed;
        task.path = conveyor.path;
        vehicleId = conveyor.id;
        if (this.s.finance.cashMinor < 10) continue;
        transportCost = 10;
      } else {
        const vehicle = this.s.enterprise.vehicles.find(
          (v) => v.enabled && v.capacityKg >= weight && !busyVehicles.has(v.id),
        );
        if (vehicle?.kind === "agv") {
          if (
            !this.s.enterprise.utilities.some(
              (u) => u.kind === "power" && u.enabled,
            )
          )
            continue;
          mode = "agv";
          speed = vehicle.speed;
          vehicleId = vehicle.id;
          if (this.s.finance.cashMinor < 25) continue;
          transportCost = 25;
        } else {
          const worker = availableWorkers.find((w) =>
            onShift(this.s, w, this.now, 0, vehicle ? "forklift" : undefined),
          );
          if (!worker) continue;
          workerId = worker.id;
          if (vehicle) {
            mode = "forklift";
            speed = vehicle.speed;
            vehicleId = vehicle.id;
          } else if (weight > 30) continue;
        }
        const home = { x: 2, y: 2 },
          router = vehicle?.width === 2 ? widePath : path;
        let empty = router(this.s, home, port(this.s, task.from)),
          loaded = router(
            this.s,
            port(this.s, task.from),
            port(this.s, task.to),
          ),
          back = router(this.s, port(this.s, task.to), home);
        if (
          (!empty || !loaded || !back) &&
          mode === "forklift" &&
          weight <= 30
        ) {
          mode = "manual";
          speed = 0.5;
          vehicleId = null;
          empty = path(this.s, home, port(this.s, task.from));
          loaded = path(this.s, port(this.s, task.from), port(this.s, task.to));
          back = path(this.s, port(this.s, task.to), home);
        }
        if (!empty || !loaded || !back) continue;
        task.path = [...empty, ...loaded.slice(1), ...back.slice(1)];
      }
      const start = this.advanced.trafficStart(task.path, this.now),
        duration = Math.max(5, task.path.length / speed);
      const worker = this.s.employees.find((w) => w.id === workerId);
      if (worker && !onShift(this.s, worker, start, duration)) continue;
      if (transportCost)
        this.spend(
          transportCost,
          mode === "agv" ? "Energie AGV" : "Energie dopravníku",
          true,
        );
      task.started = start;
      task.due = start + duration;
      task.workerId = workerId;
      if (workerId) {
        const index = availableWorkers.findIndex((w) => w.id === workerId);
        if (index >= 0) availableWorkers.splice(index, 1);
      }
      if (vehicleId) busyVehicles.add(vehicleId);
      Object.assign(meta, { mode, vehicleId, notBefore: start });
      this.schedule("transfer", task.id, task.due);
    }
  }
  private reconcile() {
    const placedById = new Map(this.s.machines.map((m) => [m.id, m])),
      definitions = new Map(machines.map((m) => [m.id, m])),
      recipesById = new Map(OPERATIONS.map((r) => [r.id, r])),
      workers = new Map(this.s.employees.map((w) => [w.id, w]));
    let runningPower = this.f.machines
      .filter((m) => m.due !== null)
      .reduce(
        (n, m) =>
          n + definitions.get(placedById.get(m.id)!.definitionId)!.ratedPowerKw,
        0,
      );

    for (const m of this.f.machines) {
      if (this.dirty !== null && !this.dirty.has(m.id)) continue;
      const instance = placedById.get(m.id)!,
        def = definitions.get(instance.definitionId)!,
        r = recipesById.get(m.recipeId)!;
      if (m.due !== null) continue;
      if (
        instance.status === "fault" ||
        instance.status === "maintenance" ||
        instance.status === "changeover"
      )
        continue;
      const roster = this.s.enterprise.rosters[m.id];
      if (roster) {
        const chosen = roster
          .map((id) => workers.get(id))
          .find((w) =>
            onShift(this.s, w, this.now, r.seconds, requiredSkill(def.id)),
          );
        if (chosen) m.workerId = chosen.id;
      }
      const worker = workers.get(m.workerId ?? "");
      const automatic = this.s.enterprise.automatic.includes(m.id);
      const qualified =
        automatic ||
        onShift(this.s, worker, this.now, r.seconds, requiredSkill(def.id));
      const fail = (reason: string, status: typeof instance.status) => {
        m.reason = reason;
        instance.status = status;
        recordState(this.s, m.id, status, this.now);
      };
      if (!m.enabled) {
        fail("Výroba vypnuta.", "idle");
        continue;
      }
      if (!m.power || !m.air) {
        fail(
          !m.power ? "Chybí elektrická přípojka." : "Chybí stlačený vzduch.",
          "waiting_for_utilities",
        );
        continue;
      }
      if (!qualified) {
        fail("Není přiřazen dostupný operátor.", "idle");
        continue;
      }
      if (
        runningPower + def.ratedPowerKw > this.f.powerCapacityKw ||
        !utilityReady(this.s, m.id, "power", def.ratedPowerKw)
      ) {
        fail(
          "Nedostatečný příkon nebo odpojený zdroj.",
          "waiting_for_utilities",
        );
        continue;
      }
      const media = demands(r);
      const missingMedia = Object.entries(media).find(
        ([kind, amount]) =>
          (this.s.enterprise.policies.detailedUtilities ||
            r.machineId === "M009" ||
            r.machineId === "M008") &&
          !utilityReady(this.s, m.id, kind as UtilityKind, amount),
      );
      if (missingMedia) {
        fail(
          "Chybí médium nebo kapacita: " + missingMedia[0],
          "waiting_for_utilities",
        );
        continue;
      }
      if (this.s.enterprise.genealogy.length >= 90000) {
        fail(
          "Archiv aktivních šarží je plný; expedujte nebo zpracujte zásoby.",
          "blocked",
        );
        continue;
      }
      const output = this.inventory
        .at(`${m.id}:out`)
        .reduce((n, l) => n + l.quantity, 0);
      if (
        output + r.outputs.reduce((n, o) => n + o.amount, 0) >
        m.outputCapacity
      ) {
        fail("Plný výstupní buffer.", "blocked");
        continue;
      }
      if (r.inputs.reduce((n, i) => n + i.amount, 0) > m.inputCapacity) {
        fail("Nedostatečná kapacita vstupního bufferu.", "blocked");
        continue;
      }
      let missing = false;
      for (const input of r.inputs) {
        const have = this.stock(input.itemId, `${m.id}:in`);
        const incoming = this.f.transfers
          .filter((t) => t.to === `${m.id}:in`)
          .reduce(
            (n, t) =>
              n +
              (this.inventory.lot(t.lotId)?.itemId === input.itemId
                ? t.quantity
                : 0),
            0,
          );
        let need = round(input.amount - have - incoming);
        if (have + 1e-7 < input.amount) missing = true;
        if (need > 1e-7) {
          for (const lot of this.inventory.stored(input.itemId)) {
            if (
              !storageLocation(lot.locationId) ||
              lot.itemId !== input.itemId ||
              lot.quality !== "good"
            )
              continue;
            const amount = Math.min(
              need,
              lot.quantity - lot.reserved - this.advanced.isAllocated(lot),
            );
            if (amount > 1e-7) {
              this.createTransfer(lot, amount, `${m.id}:in`);
              need = round(need - amount);
            }
            if (need < 1e-7) break;
          }
        }
      }
      if (missing) {
        const absent = r.inputs
          .filter((i) => this.stock(i.itemId, `${m.id}:in`) + 1e-7 < i.amount)
          .map((i) => items.find((x) => x.id === i.itemId)?.name ?? i.itemId);
        fail(
          "Chybí vstupy / čeká se na dopravu: " + absent.join(", "),
          "starved",
        );
        continue;
      }
      const energyCost = Math.round(
        ((def.ratedPowerKw * 0.6 * r.seconds) / 3600) * COSTS.electricityPerKwh,
      );
      if (this.s.finance.cashMinor < energyCost) {
        fail("Nedostatek hotovosti na energie.", "idle");
        continue;
      }
      this.spend(energyCost, "Energie", true);
      m.cycleCostMinor = 0;
      m.cycleBatchIds = [];
      for (const input of r.inputs) {
        const result = this.consume(
          input.itemId,
          input.amount,
          `${m.id}:in`,
          false,
        );
        m.cycleCostMinor += result.cost;
        m.cycleBatchIds.push(...result.batches);
      }
      this.cleanup();
      m.due = this.now + r.seconds;
      runningPower += def.ratedPowerKw;
      recordState(this.s, m.id, "running", this.now);
      instance.status = "running";
      m.reason = "Výroba probíhá.";
      this.schedule("cycle", m.id, m.due);
    }
    for (const lot of this.s.lots) {
      if (
        !lot.locationId.endsWith(":out") ||
        lot.quantity - lot.reserved <= 1e-7
      )
        continue;
      const belt = this.s.enterprise.conveyors.find(
        (c) => c.enabled && c.from === lot.locationId,
      );
      let target = "warehouse",
        amount = round(lot.quantity - lot.reserved);
      if (belt) {
        if (storageLocation(belt.to)) target = belt.to;
        else {
          const m = this.f.machines.find((m) => `${m.id}:in` === belt.to),
            r = OPERATIONS.find((r) => r.id === m?.recipeId);
          if (
            m &&
            r?.inputs.some((input) => input.itemId === lot.itemId) &&
            lot.quality === "good"
          ) {
            const used =
              this.s.lots
                .filter((l) => l.locationId === belt.to)
                .reduce((n, l) => n + l.quantity, 0) +
              this.f.transfers
                .filter((t) => t.to === belt.to)
                .reduce((n, t) => n + t.quantity, 0);
            target = belt.to;
            amount = Math.min(amount, m.inputCapacity - used);
          }
        }
      }
      if (amount > 1e-7) this.createTransfer(lot, amount, target);
    }
    this.dispatch();
  }
  advance(until: number): void {
    let next = this.f.events[0];
    while (next && next.at <= until) {
      const at = next.at;
      this.now = at;
      this.dirty = new Set();
      this.invalidate();
      // Equal-time completions form one deterministic batch; reconcile once after all releases.
      while (this.f.events[0] && this.f.events[0]!.at <= at + 1e-9) {
        const event = pop(this.f.events)!;
        if (
          [
            "calendar",
            "payroll",
            "training",
            "research",
            "repair",
            "changeover",
          ].includes(event.kind)
        )
          this.dirty = null;
        this.handle(event);
      }
      this.reconcile();
      next = this.f.events[0];
    }
    this.now = until;
  }
  private handle(e: ScheduledEvent) {
    if (this.advanced.event(e)) return;
    switch (e.kind) {
      case "cycle": {
        this.dirty?.add(e.id);
        for (const placed of this.s.machines)
          if (placed.status === "waiting_for_utilities")
            this.dirty?.add(placed.id);
        const m = this.machine(e.id);
        if (m.due !== e.at) return;
        const worker = this.s.employees.find((w) => w.id === m.workerId);
        if (
          !this.s.enterprise.automatic.includes(m.id) &&
          !onShift(
            this.s,
            worker,
            Math.max(0, this.now - 1e-6),
            0,
            requiredSkill(
              this.s.machines.find((x) => x.id === m.id)!.definitionId,
            ),
          )
        ) {
          m.due = Math.max(e.at + 3600, nextShift(this.s, worker, this.now));
          m.reason = "Čekání na dostupného operátora / úhradu mezd.";
          recordState(this.s, m.id, "staff", this.now);
          this.schedule("cycle", m.id, m.due);
          return;
        }
        const r = OPERATIONS.find((r) => r.id === m.recipeId)!;
        let failed = false;
        if (r.test) {
          this.f.tested++;
          this.s.rngState =
            (Math.imul(1664525, this.s.rngState) + 1013904223) >>> 0;
          failed = this.s.rngState / 4294967296 < 0.03;
        }
        this.advanced.completed(m.id, r.seconds, !failed);
        const batch = this.id("batch");
        this.s.enterprise.genealogy.push({
          id: batch,
          parents: [...new Set(m.cycleBatchIds)],
          itemId: r.outputs[0]!.itemId,
          quantity: r.outputs[0]!.amount,
          at: this.now,
          recipeId: r.id,
          quality: failed ? "quarantine" : "good",
        });
        if (r.test)
          this.s.enterprise.inspections.push({
            batchId: batch,
            machineId: m.id,
            at: this.now,
            passed: !failed,
          });
        if (failed) {
          this.addLot("W004", 1, `${m.id}:out`, 0, "quarantine", batch);
          this.s.finance.expensesMinor += m.cycleCostMinor;
          m.rejected++;
          this.f.rejected++;
        } else {
          r.outputs.forEach((o, i) =>
            this.addLot(
              o.itemId,
              o.amount,
              `${m.id}:out`,
              i === 0 ? m.cycleCostMinor : 0,
              o.itemId.startsWith("SCRAP") ? "scrap" : "good",
              batch,
            ),
          );
          m.completed++;
        }
        m.due = null;
        m.cycleCostMinor = 0;
        m.cycleBatchIds = [];
        const placed = this.s.machines.find((i) => i.id === m.id)!;
        placed.condition = Math.max(0, placed.condition - 0.0001);
        this.s.rngState =
          (Math.imul(1664525, this.s.rngState) + 1013904223) >>> 0;
        if (
          placed.condition < 0.5 ||
          this.s.rngState / 4294967296 <
            0.0005 * (1 + (1 - placed.condition) * 5)
        ) {
          placed.status = "fault";
          m.reason = "Porucha: potřebujete údržbáře a sadu náhradních dílů.";
          const service = this.s.enterprise.service[m.id];
          if (service) {
            service.lastFault = this.now;
            service.failures++;
            service.faultReason =
              r.machineId === "M009"
                ? "Odchylka teplotního profilu"
                : r.machineId === "M001"
                  ? "Opotřebení nástroje"
                  : "Porucha pohonu";
          }
          recordState(this.s, m.id, "fault", this.now);
        }
        break;
      }
      case "transfer": {
        const t = this.f.transfers.find((t) => t.id === e.id);
        if (!t) return;
        if (!storageLocation(t.from)) this.dirty?.add(t.from.split(":")[0]!);
        const automated = this.s.enterprise.transport.find(
          (meta) => meta.taskId === t.id,
        )?.mode;
        if (
          (!automated || automated === "manual" || automated === "forklift") &&
          !onShift(
            this.s,
            this.s.employees.find((w) => w.id === t.workerId),
            Math.max(0, this.now - 1e-6),
          )
        ) {
          t.due = e.at + 3600;
          this.schedule("transfer", t.id, t.due);
          return;
        }
        const lot = this.s.lots.find((l) => l.id === t.lotId);
        if (!lot) throw new Error("Porušená rezervace přepravy.");
        const cost = Math.round((lot.costMinor * t.quantity) / lot.quantity);
        lot.costMinor -= cost;
        lot.quantity = round(lot.quantity - t.quantity);
        lot.reserved = round(lot.reserved - t.quantity);
        this.addLot(
          lot.itemId,
          t.quantity,
          t.to,
          cost,
          lot.quality,
          lot.batchId,
        );
        this.cleanup();
        this.f.transfers = this.f.transfers.filter((x) => x.id !== t.id);
        this.f.totalTransfers++;
        this.s.enterprise.transport = this.s.enterprise.transport.filter(
          (meta) => meta.taskId !== t.id,
        );
        break;
      }
      case "delivery": {
        const d = this.f.deliveries.find((x) => x.id === e.id);
        if (!d) return;
        const target = this.s.enterprise.deliveryZones[d.id] ?? "warehouse";
        // Existing receipt reservation must be excluded from its own capacity check.
        delete this.s.enterprise.deliveryZones[d.id];
        if (!accepts(this.s, target, d.itemId, d.quantity)) {
          this.s.enterprise.deliveryZones[d.id] = target;
          d.due = this.now + 3600;
          this.schedule("delivery", d.id, d.due);
          return;
        }
        const dock = this.s.enterprise.deliveryDocks[d.id];
        if (dock) {
          this.addLot(d.itemId, d.quantity, dock, d.costMinor);
          for (const lot of this.s.lots.filter(
            (l) =>
              l.locationId === dock &&
              l.itemId === d.itemId &&
              l.quantity > l.reserved,
          ))
            this.createTransfer(lot, lot.quantity - lot.reserved, target);
          delete this.s.enterprise.deliveryDocks[d.id];
        } else this.addLot(d.itemId, d.quantity, target, d.costMinor);
        this.f.deliveries = this.f.deliveries.filter((x) => x.id !== d.id);
        break;
      }
      case "cooperation": {
        const c = this.f.cooperations.find((x) => x.id === e.id);
        if (!c) return;
        this.addLot(
          "W004",
          c.quantity,
          "warehouse",
          c.costMinor,
          "good",
          c.batchId,
        );
        this.f.cooperations = this.f.cooperations.filter((x) => x.id !== c.id);
        break;
      }
      case "payment": {
        const i = this.f.invoices.find((x) => x.id === e.id);
        if (!i || i.paid) return;
        i.paid = true;
        this.s.finance.cashMinor += i.amountMinor;
        this.s.finance.receivablesMinor -= i.amountMinor;
        this.f.contracts.find((c) => c.id === i.contractId)!.status = "paid";
        this.log("Inkaso faktury", i.amountMinor);
        break;
      }
      case "repair": {
        const m = this.machine(e.id),
          placed = this.s.machines.find((x) => x.id === m.id)!;
        this.advanced.beforeRepair(m.id);
        placed.condition = 1;
        placed.status = "idle";
        m.reason = "Oprava dokončena.";
        break;
      }
      case "payroll": {
        this.advanced.compactHistory();
        const total = this.s.employees.reduce((n, w) => n + w.wageMinor, 0);
        const due = this.s.finance.payablesMinor + total,
          paid = Math.min(due, this.s.finance.cashMinor);
        this.s.finance.cashMinor -= paid;
        this.s.finance.payablesMinor = due - paid;
        this.s.finance.expensesMinor += total;
        this.s.employees.forEach(
          (w) => (w.available = this.s.finance.payablesMinor === 0),
        );
        this.log("Mzdy", -paid);
        this.schedule("payroll", "daily", this.now + 86400);
        break;
      }
    }
  }
}
