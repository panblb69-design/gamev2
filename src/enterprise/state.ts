import { z } from "zod";
const n = z.number().finite().nonnegative(),
  int = n.int().max(Number.MAX_SAFE_INTEGER),
  id = z.string().min(1).max(150),
  point = z.object({ x: int.max(99), y: int.max(69) });
export const utilityKind = z.enum([
  "power",
  "air",
  "water",
  "nitrogen",
  "exhaust",
]);
export const enterpriseSchema = z.object({
  zones: z
    .array(
      z.object({
        id,
        name: z.string().min(1).max(80),
        x: int.max(99),
        y: int.max(69),
        width: int.min(1).max(100),
        height: int.min(1).max(70),
        maxKg: n.positive(),
        maxM3: n.positive(),
        kind: z.enum(["raw", "wip", "finished", "quarantine", "mixed"]),
      }),
    )
    .max(100)
    .default([]),
  containers: z
    .array(
      z.object({
        id,
        lotId: id,
        kind: z.enum(["bin", "pallet", "tank"]),
        maxKg: n.positive(),
      }),
    )
    .max(50000)
    .default([]),
  vehicles: z
    .array(
      z.object({
        id,
        kind: z.enum(["forklift", "agv"]),
        capacityKg: n.positive(),
        speed: n.positive(),
        width: int.min(1).max(3),
        enabled: z.boolean(),
      }),
    )
    .max(200)
    .default([]),
  transport: z
    .array(
      z.object({
        taskId: id,
        vehicleId: id.nullable(),
        notBefore: n,
        mode: z.enum(["manual", "forklift", "agv", "conveyor"]),
      }),
    )
    .max(10000)
    .default([]),
  docks: z
    .array(
      z.object({
        id,
        x: int.max(99),
        y: int.max(69),
        openHour: int.max(23),
        closeHour: int.min(1).max(24),
        busyUntil: n,
      }),
    )
    .max(20)
    .default([]),
  deliveryDocks: z.record(z.string(), id).default({}),
  deliveryZones: z.record(z.string(), id).default({}),
  shipments: z
    .array(z.object({ id, lotId: id, quantity: n.positive(), to: id }))
    .max(10000)
    .default([]),
  plans: z
    .array(
      z.object({
        id,
        contractId: id,
        productId: id,
        quantity: int.min(1),
        status: z.enum(["planned", "released", "done"]),
        reservedLotIds: z.array(id),
        purchased: z.record(z.string(), n),
      }),
    )
    .max(10000)
    .default([]),
  allocations: z
    .array(z.object({ lotId: id, contractId: id, quantity: n.positive() }))
    .max(50000)
    .default([]),
  frameworks: z
    .array(
      z.object({
        id,
        productId: id,
        quantity: int.min(1),
        priceMinor: int,
        start: n,
        next: n,
        end: n,
        paymentDays: int.min(1),
        active: z.boolean(),
      }),
    )
    .max(100)
    .default([]),
  contractProducts: z.record(z.string(), id).default({}),
  penalties: z.record(z.string(), int).default({}),
  quotes: z
    .record(z.string(), z.object({ priceMinor: int, accepted: z.boolean() }))
    .default({}),
  rosters: z.record(z.string(), z.array(id).min(1).max(20)).default({}),
  workerProfiles: z
    .record(
      z.string(),
      z.object({
        shift: z.enum(["continuous", "morning", "afternoon", "night"]),
        skills: z.array(id),
        trainingUntil: n,
        trainingSkill: id.nullable(),
        absenceUntil: n,
      }),
    )
    .default({}),
  service: z
    .record(
      z.string(),
      z.object({
        intervalCycles: int.min(1),
        lastCycles: int,
        lastFault: n,
        failures: int,
        repairSeconds: n,
        scheduled: n.nullable(),
        faultReason: z.string().max(150),
      }),
    )
    .default({}),
  utilities: z
    .array(
      z.object({
        id,
        kind: utilityKind,
        x: int.max(99),
        y: int.max(69),
        capacity: n.positive(),
        enabled: z.boolean(),
      }),
    )
    .max(1000)
    .default([
      {
        id: "grid-power",
        kind: "power",
        x: 2,
        y: 2,
        capacity: 500,
        enabled: true,
      },
      { id: "grid-air", kind: "air", x: 2, y: 2, capacity: 100, enabled: true },
    ]),
  links: z
    .array(
      z.object({
        machineId: id,
        kind: utilityKind,
        sourceId: id,
        path: z.array(point).min(1).max(7000),
      }),
    )
    .max(6000)
    .default([]),
  genealogy: z
    .array(
      z.object({
        id,
        parents: z.array(z.string().max(100000)).max(200),
        itemId: id,
        quantity: n.positive(),
        at: n,
        recipeId: id,
        quality: z.enum(["good", "quarantine", "scrap"]),
      }),
    )
    .max(100000)
    .default([]),
  inspections: z
    .array(z.object({ batchId: id, machineId: id, at: n, passed: z.boolean() }))
    .max(100000)
    .default([]),
  automatic: z.array(id).max(1000).default([]),
  conveyors: z
    .array(
      z.object({
        id,
        from: id,
        to: id,
        path: z.array(point).min(1).max(7000),
        enabled: z.boolean(),
        speed: n.positive(),
        capacityKg: n.positive(),
      }),
    )
    .max(1000)
    .default([]),
  research: z
    .array(z.object({ id, status: z.enum(["running", "done"]), due: n }))
    .max(20)
    .default([]),
  metrics: z
    .record(
      z.string(),
      z.object({
        lastAt: n,
        state: z.string(),
        times: z.record(z.string(), n),
        idealSeconds: n,
        cycles: int,
        good: int,
        failures: int,
      }),
    )
    .default({}),
  reports: z
    .array(
      z.object({
        day: int,
        cashMinor: int,
        revenueMinor: int,
        expensesMinor: int,
        inventoryMinor: int,
        shipped: int,
      }),
    )
    .max(366)
    .default([]),
  replenish: z
    .array(
      z.object({
        itemId: id,
        minimum: n,
        target: n.positive(),
        enabled: z.boolean(),
      }),
    )
    .max(100)
    .default([]),
  policies: z
    .object({
      detailedUtilities: z.boolean().default(false),
      localBrazing: z.boolean().default(false),
      traffic: z.boolean().default(true),
      autoService: z.boolean().default(false),
    })
    .default({
      detailedUtilities: false,
      localBrazing: false,
      traffic: true,
      autoService: false,
    }),
  calendarActive: z.boolean().default(false),
  marketActive: z.boolean().default(false),
});
export type Enterprise = z.infer<typeof enterpriseSchema>;
export function createEnterprise(): Enterprise {
  return enterpriseSchema.parse({});
}
