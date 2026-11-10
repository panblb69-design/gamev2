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
  port,
  warehouse,
} from "../world/path";
import { push, pop } from "./queue";
export type FactoryCommand =
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
  | { type: "hire"; role: "operator" | "warehouse" | "mechanic" }
  | { type: "configure"; machineId: string; recipeId: string; enabled: boolean }
  | { type: "assign"; machineId: string; workerId: string }
  | { type: "buy"; itemId: string; quantity: number }
  | { type: "cooperate"; quantity: number }
  | { type: "accept"; contractId: string }
  | { type: "ship"; contractId: string }
  | { type: "repair"; machineId: string };
const round = (n: number) => Math.round(n * 1e6) / 1e6;
export class FactoryEngine {
  private now: number;
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
    const existing = this.s.lots.find(
      (l) =>
        l.itemId === itemId &&
        l.locationId === locationId &&
        l.quality === quality &&
        l.batchId === batchId,
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
  }
  stock(itemId: string, location = "warehouse"): number {
    return round(
      this.s.lots
        .filter(
          (l) =>
            l.itemId === itemId &&
            l.locationId === location &&
            l.quality === "good",
        )
        .reduce((n, l) => n + l.quantity - l.reserved, 0),
    );
  }
  private consume(
    itemId: string,
    quantity: number,
    location: string,
  ): { cost: number; batches: string[] } {
    if (this.stock(itemId, location) + 1e-7 < quantity)
      throw new Error("Chybí materiál.");
    let left = quantity,
      cost = 0;
    const batches: string[] = [];
    for (const lot of this.s.lots) {
      if (
        lot.itemId !== itemId ||
        lot.locationId !== location ||
        lot.quality !== "good"
      )
        continue;
      const take = Math.min(left, lot.quantity - lot.reserved);
      if (take <= 0) continue;
      const value = Math.round((lot.costMinor * take) / lot.quantity);
      cost += value;
      lot.costMinor -= value;
      lot.quantity = round(lot.quantity - take);
      left = round(left - take);
      batches.push(lot.batchId);
      if (left <= 1e-7) break;
    }
    this.s.lots = this.s.lots.filter((l) => l.quantity > 1e-7);
    return { cost, batches };
  }
  private machine(id: string): ProductionMachine {
    const m = this.f.machines.find((m) => m.id === id);
    if (!m) throw new Error("Neznámý stroj.");
    return m;
  }
  command(commandId: string, c: FactoryCommand): void {
    if (!commandId || commandId.length > 150)
      throw new Error("Neplatné ID příkazu.");
    if (this.f.processedCommands.includes(commandId)) return;
    if (this.f.processedCommands.length >= 10000)
      throw new Error("Dosažen limit příkazů tohoto save. Exportujte hru.");
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
        if (!["operator", "warehouse", "mechanic"].includes(c.role))
          throw new Error("Neznámá profese.");
        this.spend(COSTS.hire, "Nábor", true);
        this.s.employees.push({
          id: this.id("worker"),
          role: c.role,
          skills:
            c.role === "operator"
              ? ["operátor", "montážník", "kontrolor", "balič"]
              : [],
          wageMinor: COSTS.wageDaily,
          shiftId: "continuous",
          available: true,
        });
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
          (w) => w.id === c.workerId && w.role === "operator",
        );
        if (
          !worker ||
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
        const id = this.id("delivery"),
          due = this.now + COSTS.deliverySeconds;
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
        this.f.cooperations.push({
          id,
          quantity: c.quantity,
          due,
          batchId: consumed.batches.join("+"),
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
          this.s.employees.filter((w) => w.role === "mechanic" && w.available)
            .length <= this.f.events.filter((e) => e.kind === "repair").length
        )
          throw new Error("Chybí volný údržbář.");
        const consumed = this.consume("SPARE", 1, "warehouse");
        this.s.finance.expensesMinor += consumed.cost;
        placed.status = "maintenance";
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
        break;
      }
      case "ship": {
        const contract = this.f.contracts.find(
          (x) => x.id === c.contractId && x.status === "accepted",
        );
        if (!contract || this.stock("FE-HX001") < contract.quantity)
          throw new Error("Chybí přijatá zakázka nebo dobré zabalené kusy.");
        this.spend(contract.quantity * COSTS.shippingPerUnit, "Expedice", true);
        const consumed = this.consume(
          "FE-HX001",
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
        this.schedule("payment", id, due);
        this.log("Vystavena faktura (bez inkasa)", 0);
        break;
      }
    }
    this.f.processedCommands.push(commandId);
    this.reconcile();
  }
  private createTransfer(lot: InventoryLot, quantity: number, to: string) {
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
    this.f.transfers.push({
      id: this.id("transfer"),
      lotId: lot.id,
      quantity,
      from: lot.locationId,
      to,
      path: route,
      started: null,
      due: null,
      workerId: null,
    });
  }
  private dispatch() {
    for (const worker of this.s.employees) {
      if (
        worker.role !== "warehouse" ||
        !worker.available ||
        this.f.transfers.some((t) => t.workerId === worker.id)
      )
        continue;
      const task = this.f.transfers.find((t) => t.started === null);
      if (!task) break;
      // Each job starts at the warehouse, walks empty to pickup, then returns loaded.
      const empty = path(this.s, warehouse, port(this.s, task.from));
      if (!empty) continue;
      task.path = [...empty, ...task.path.slice(1)];
      if (task.to !== "warehouse") {
        const back = path(this.s, port(this.s, task.to), warehouse);
        if (back) task.path.push(...back.slice(1));
      }
      task.started = this.now;
      task.due = this.now + Math.max(5, task.path.length * 2);
      task.workerId = worker.id;
      this.schedule("transfer", task.id, task.due);
    }
  }
  private reconcile() {
    for (const m of this.f.machines) {
      const instance = this.s.machines.find((i) => i.id === m.id)!,
        def = machines.find((d) => d.id === instance.definitionId)!,
        r = OPERATIONS.find((r) => r.id === m.recipeId)!;
      if (m.due !== null) continue;
      if (instance.status === "fault" || instance.status === "maintenance")
        continue;
      const worker = this.s.employees.find(
        (w) => w.id === m.workerId && w.available,
      );
      const fail = (reason: string, status: typeof instance.status) => {
        m.reason = reason;
        instance.status = status;
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
      if (!worker) {
        fail("Není přiřazen dostupný operátor.", "idle");
        continue;
      }
      if (
        this.f.machines
          .filter((x) => x.due !== null)
          .reduce(
            (n, x) =>
              n +
              machines.find(
                (d) =>
                  d.id ===
                  this.s.machines.find((i) => i.id === x.id)!.definitionId,
              )!.ratedPowerKw,
            0,
          ) +
          def.ratedPowerKw >
        this.f.powerCapacityKw
      ) {
        fail("Nedostatečný příkon přípojky (500 kW).", "waiting_for_utilities");
        continue;
      }
      const output = this.s.lots
        .filter((l) => l.locationId === `${m.id}:out`)
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
              (this.s.lots.find((l) => l.id === t.lotId)?.itemId ===
              input.itemId
                ? t.quantity
                : 0),
            0,
          );
        let need = round(input.amount - have - incoming);
        if (have + 1e-7 < input.amount) missing = true;
        if (need > 1e-7) {
          for (const lot of this.s.lots) {
            if (
              lot.locationId !== "warehouse" ||
              lot.itemId !== input.itemId ||
              lot.quality !== "good"
            )
              continue;
            const amount = Math.min(need, lot.quantity - lot.reserved);
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
        const result = this.consume(input.itemId, input.amount, `${m.id}:in`);
        m.cycleCostMinor += result.cost;
        m.cycleBatchIds.push(...result.batches);
      }
      m.due = this.now + r.seconds;
      instance.status = "running";
      m.reason = "Výroba probíhá.";
      this.schedule("cycle", m.id, m.due);
    }
    for (const lot of this.s.lots) {
      if (lot.locationId.endsWith(":out") && lot.quantity - lot.reserved > 1e-7)
        this.createTransfer(
          lot,
          round(lot.quantity - lot.reserved),
          "warehouse",
        );
    }
    this.dispatch();
  }
  advance(until: number): void {
    let event = this.f.events[0];
    while (event && event.at <= until) {
      pop(this.f.events);
      this.now = event.at;
      this.handle(event);
      this.reconcile();
      event = this.f.events[0];
    }
    this.now = until;
  }
  private handle(e: ScheduledEvent) {
    switch (e.kind) {
      case "cycle": {
        const m = this.machine(e.id);
        if (m.due !== e.at) return;
        const worker = this.s.employees.find((w) => w.id === m.workerId);
        if (!worker?.available) {
          m.due = e.at + 3600;
          m.reason = "Čekání na dostupného operátora / úhradu mezd.";
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
        if (failed) {
          this.addLot(
            "W004",
            1,
            `${m.id}:out`,
            0,
            "quarantine",
            m.cycleBatchIds.join("+"),
          );
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
              m.cycleBatchIds.join("+"),
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
        if (placed.condition < 0.5 || this.s.rngState / 4294967296 < 0.0005) {
          placed.status = "fault";
          m.reason = "Porucha: potřebujete údržbáře a sadu náhradních dílů.";
        }
        break;
      }
      case "transfer": {
        const t = this.f.transfers.find((t) => t.id === e.id);
        if (!t) return;
        if (!this.s.employees.find((w) => w.id === t.workerId)?.available) {
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
        this.s.lots = this.s.lots.filter((l) => l.quantity > 1e-7);
        this.f.transfers = this.f.transfers.filter((x) => x.id !== t.id);
        this.f.totalTransfers++;
        break;
      }
      case "delivery": {
        const d = this.f.deliveries.find((x) => x.id === e.id);
        if (!d) return;
        this.addLot(d.itemId, d.quantity, "warehouse", d.costMinor);
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
        placed.condition = 1;
        placed.status = "idle";
        m.reason = "Oprava dokončena.";
        break;
      }
      case "payroll": {
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
