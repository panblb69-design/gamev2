import { GAME_SECONDS_PER_TICK } from "../core/time";
import { z } from "zod";
import { items, machines } from "../data/catalog";
import { OPERATIONS } from "../manufacturing/catalog";
import { createFactory } from "../manufacturing/model";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  positive = z.number().finite().positive(),
  quantity = z.number().finite().nonnegative();
const id = z.string().min(1).max(150),
  point = z.object({ x: integer.max(99), y: integer.max(69) }),
  rect = point.extend({
    width: integer.min(10).max(95),
    height: integer.min(10).max(65),
  });
const itemId = z.enum(items.map((i) => i.id) as [string, ...string[]]),
  definitionId = z.enum(machines.map((m) => m.id) as [string, ...string[]]),
  recipeId = z.enum(OPERATIONS.map((r) => r.id) as [string, ...string[]]);
const status = z.enum([
  "unplaced",
  "placed",
  "installing",
  "waiting_for_utilities",
  "idle",
  "running",
  "starved",
  "blocked",
  "changeover",
  "maintenance",
  "fault",
]);
const game = z
  .object({
    schemaVersion: z.literal(2),
    tick: integer,
    rngState: integer.max(0xffffffff),
    speed: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(5),
      z.literal(10),
    ]),
    world: z.object({
      width: z.literal(100),
      height: z.literal(70),
      owned: z.boolean(),
    }),
    finance: z.object({
      cashMinor: integer,
      receivablesMinor: integer,
      payablesMinor: integer,
      revenueMinor: integer,
      expensesMinor: integer,
      investorShare: z.literal(0.35),
    }),
    machines: z
      .array(
        z.object({
          id,
          definitionId,
          x: integer.max(99),
          y: integer.max(69),
          orientation: z.union([
            z.literal(0),
            z.literal(90),
            z.literal(180),
            z.literal(270),
          ]),
          status,
          condition: z.number().min(0).max(1),
        }),
      )
      .max(1000),
    lots: z
      .array(
        z.object({
          id,
          itemId,
          quantity: positive,
          reserved: quantity,
          locationId: id,
          quality: z.enum(["unchecked", "good", "quarantine", "scrap"]),
          batchId: z.string().max(100000),
          costMinor: integer,
        }),
      )
      .max(50000),
    employees: z
      .array(
        z.object({
          id,
          role: z.enum(["operator", "warehouse", "mechanic"]),
          skills: z.array(z.string()).max(20),
          wageMinor: integer,
          shiftId: id,
          available: z.boolean(),
        }),
      )
      .max(1000),
    logisticsTasks: z.array(z.never()).length(0),
    factory: z.object({
      hall: rect.nullable(),
      revision: integer,
      nextId: integer.min(1),
      eventSeq: integer,
      processedCommands: z.array(id).max(10000),
      events: z
        .array(
          z.object({
            at: quantity,
            seq: integer,
            kind: z.enum([
              "cycle",
              "transfer",
              "delivery",
              "cooperation",
              "payment",
              "payroll",
              "repair",
            ]),
            id,
          }),
        )
        .max(100000),
      machines: z
        .array(
          z.object({
            id,
            recipeId,
            enabled: z.boolean(),
            power: z.boolean(),
            air: z.boolean(),
            workerId: id.nullable(),
            due: quantity.nullable(),
            reason: z.string().max(5000),
            completed: integer,
            rejected: integer,
            inputCapacity: integer.min(1),
            outputCapacity: positive,
            powerPath: z.array(point).max(7000),
            cycleCostMinor: integer,
            cycleBatchIds: z.array(z.string().max(100000)).max(100),
          }),
        )
        .max(1000),
      transfers: z
        .array(
          z.object({
            id,
            lotId: id,
            quantity: positive,
            from: id,
            to: id,
            path: z.array(point).min(1).max(21000),
            started: quantity.nullable(),
            due: quantity.nullable(),
            workerId: id.nullable(),
          }),
        )
        .max(10000),
      deliveries: z
        .array(
          z.object({
            id,
            itemId,
            quantity: positive,
            costMinor: integer,
            due: quantity,
          }),
        )
        .max(10000),
      cooperations: z
        .array(
          z.object({
            id,
            quantity: integer.min(1),
            due: quantity,
            batchId: z.string().max(100000),
            costMinor: integer,
          }),
        )
        .max(10000),
      invoices: z
        .array(
          z.object({
            id,
            contractId: id,
            quantity: integer.min(1),
            amountMinor: integer,
            due: quantity,
            paid: z.boolean(),
          }),
        )
        .max(10000),
      contracts: z
        .array(
          z.object({
            id,
            quantity: integer.min(1),
            unitPriceMinor: integer,
            deadline: quantity,
            paymentDays: integer.min(1),
            status: z.enum(["offer", "accepted", "shipped", "paid"]),
          }),
        )
        .max(10000),
      powerCapacityKw: positive,
      storageCapacity: positive,
      shipped: integer,
      tested: integer,
      rejected: integer,
      totalTransfers: integer,
      ledger: z
        .array(
          z.object({
            at: quantity,
            kind: z.string().max(500),
            amountMinor: z
              .number()
              .int()
              .min(-Number.MAX_SAFE_INTEGER)
              .max(Number.MAX_SAFE_INTEGER),
          }),
        )
        .max(200),
    }),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const f = s.factory;
    if (s.machines.length && !f.hall) fail("Stroje vyžadují halu.");
    if (f.rejected > f.tested) fail("Neshodné kusy převyšují počet testů.");
    const ids = [
      ...s.machines,
      ...s.lots,
      ...s.employees,
      ...f.transfers,
      ...f.deliveries,
      ...f.cooperations,
      ...f.invoices,
    ].map((x) => x.id);
    if (
      ids.some((id) => {
        const match =
          /^(machine|lot|worker|transfer|delivery|cooperation|invoice)-(\d+)$/.exec(
            id,
          );
        return match && Number(match[2]) >= f.nextId;
      })
    )
      fail("Kolize generátoru ID.");
    for (const m of s.machines) {
      const d = machines.find((d) => d.id === m.definitionId)!,
        h = f.hall,
        rotated = m.orientation === 90 || m.orientation === 270,
        w = rotated ? d.footprint.height : d.footprint.width,
        height = rotated ? d.footprint.width : d.footprint.height;
      if (
        !h ||
        m.x < h.x ||
        m.y < h.y ||
        m.x + w > h.x + h.width ||
        m.y + height > h.y + h.height
      )
        fail("Stroj mimo halu.");
    }
    for (const placed of s.machines) {
      const m = f.machines.find((m) => m.id === placed.id);
      if (placed.status === "running" && m?.due === null)
        fail("Běžící stroj nemá cyklus.");
      if (
        placed.status === "maintenance" &&
        !f.events.some((e) => e.kind === "repair" && e.id === placed.id)
      )
        fail("Chybí plánovaná oprava.");
    }

    for (const collection of [
      s.machines,
      s.lots,
      s.employees,
      f.machines,
      f.transfers,
      f.deliveries,
      f.cooperations,
      f.invoices,
      f.contracts,
    ])
      if (new Set(collection.map((x) => x.id)).size !== collection.length)
        fail("Duplicitní ID.");
    if (s.machines.length !== f.machines.length) fail("Nesoulad strojů.");
    if (
      !s.world.owned &&
      (f.hall || s.machines.length || s.employees.length || s.lots.length)
    )
      fail("Závod bez pozemku.");
    if (
      f.hall &&
      (f.hall.x < 4 ||
        f.hall.y < 4 ||
        f.hall.x + f.hall.width > 99 ||
        f.hall.y + f.hall.height > 69)
    )
      fail("Neplatná hala.");
    const validLocation = (location: string) =>
      location === "warehouse" ||
      s.machines.some(
        (m) => location === `${m.id}:in` || location === `${m.id}:out`,
      );
    for (const l of s.lots) {
      if (!validLocation(l.locationId) || l.reserved > l.quantity + 1e-6)
        fail("Neplatný sklad nebo rezervace.");
      const reserved = f.transfers
        .filter((t) => t.lotId === l.id)
        .reduce((n, t) => n + t.quantity, 0);
      if (Math.abs(reserved - l.reserved) > 1e-6)
        fail("Rezervace nemá přepravní úlohu.");
    }
    const assigned = f.machines
      .map((m) => m.workerId)
      .filter((x) => x !== null);
    if (new Set(assigned).size !== assigned.length)
      fail("Operátor obsluhuje více strojů.");
    for (const m of f.machines) {
      const placed = s.machines.find((x) => x.id === m.id);
      if (
        !placed ||
        !OPERATIONS.some(
          (r) => r.id === m.recipeId && r.machineId === placed.definitionId,
        )
      )
        fail("Neplatná receptura stroje.");
      if (
        m.workerId &&
        !s.employees.some((w) => w.id === m.workerId && w.role === "operator")
      )
        fail("Chybí operátor.");
      if (
        m.due !== null &&
        !f.events.some(
          (e) => e.kind === "cycle" && e.id === m.id && e.at === m.due,
        )
      )
        fail("Chybí událost cyklu.");
    }
    const activeWorkers = f.transfers
      .filter((t) => t.workerId)
      .map((t) => t.workerId);
    if (new Set(activeWorkers).size !== activeWorkers.length)
      fail("Skladník má více úloh.");
    for (const t of f.transfers) {
      if (
        !s.lots.some((l) => l.id === t.lotId && l.locationId === t.from) ||
        !validLocation(t.to)
      )
        fail("Neplatná přepravní reference.");
      if (
        t.workerId &&
        !s.employees.some((w) => w.id === t.workerId && w.role === "warehouse")
      )
        fail("Chybí skladník.");
      if (
        t.due !== null &&
        !f.events.some(
          (e) => e.kind === "transfer" && e.id === t.id && e.at === t.due,
        )
      )
        fail("Chybí událost přepravy.");
    }
    for (const [kind, list] of [
      ["delivery", f.deliveries],
      ["cooperation", f.cooperations],
      ["payment", f.invoices.filter((i) => !i.paid)],
    ] as const)
      for (const entry of list)
        if (
          !f.events.some(
            (e) => e.kind === kind && e.id === entry.id && e.at === entry.due,
          )
        )
          fail("Chybí plánovaná událost.");
    if (
      s.finance.receivablesMinor !==
      f.invoices.filter((i) => !i.paid).reduce((n, i) => n + i.amountMinor, 0)
    )
      fail("Nesouhlasí pohledávky.");
    for (let i = 0; i < f.events.length; i++) {
      const e = f.events[i]!;
      if (e.at < s.tick * GAME_SECONDS_PER_TICK) fail("Událost v minulosti.");
      if (i) {
        const p = f.events[(i - 1) >> 1]!;
        if (e.at < p.at || (e.at === p.at && e.seq < p.seq))
          fail("Poškozená fronta událostí.");
      }
    }
  });
export function parseSave(raw: unknown) {
  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    raw.schemaVersion === 1
  ) {
    const old = raw as Record<string, unknown>;
    const finance = old.finance as Record<string, unknown> | undefined;
    if (
      !finance ||
      finance.cashMinor !== 30_000_000_000 ||
      [
        "receivablesMinor",
        "payablesMinor",
        "revenueMinor",
        "expensesMinor",
      ].some((k) => finance[k] !== 0) ||
      !old.world ||
      typeof old.world !== "object" ||
      !("owned" in old.world) ||
      old.world.owned !== false ||
      ["machines", "lots", "employees", "logisticsTasks"].some(
        (k) => !Array.isArray(old[k]) || (old[k] as unknown[]).length,
      )
    )
      throw new Error("Poškozený save M0.");
    raw = { ...old, schemaVersion: 2, factory: createFactory() };
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !("schemaVersion" in raw) ||
    raw.schemaVersion !== 2
  )
    throw new Error("Nepodporovaná verze uložené hry.");
  const result = game.safeParse(raw);
  if (!result.success)
    throw new Error(
      "Poškozená uložená hra: " + result.error.issues[0]?.message,
    );
  return result.data;
}
