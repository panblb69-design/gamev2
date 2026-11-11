import type { GameState } from "../core/model";
import { OPERATIONS, PURCHASE_PRICES } from "../manufacturing/catalog";
import { product } from "../data/catalog";
import { storageLocation } from "../logistics/warehouse";
export const PRODUCTS = [
  {
    id: "FE-HX001",
    name: "FE-HX001",
    core: "W006",
    packRecipe: "pack",
    unitPriceMinor: 185000,
    bom: product.bom,
  },
  {
    id: "FE-HX001-P",
    name: "FE-HX001-P · ochranné exportní balení",
    core: "W006",
    packRecipe: "pack-export",
    unitPriceMinor: 205000,
    bom: [
      ...product.bom.filter((q) => q.itemId !== "C008"),
      { itemId: "C008", amount: 2, unit: "ks" as const },
    ],
  },
];
export function requirements(
  quantity: number,
  productId = "FE-HX001",
  makeComponents = false,
  localBrazing = false,
): Record<string, number> {
  const definition = PRODUCTS.find((p) => p.id === productId);
  if (!definition) throw new Error("Neznámý výrobek.");
  const result: Record<string, number> = {};
  for (const q of definition.bom) result[q.itemId] = q.amount * quantity;
  Object.assign(result, {
    U004: quantity * (localBrazing ? 5 : 4),
    U005: 0.01 * quantity,
    U003: 0.001 * quantity,
    U006: 0.01 * quantity,
  });
  if (makeComponents) {
    for (const key of ["C001", "C002", "C003", "C004", "C005"])
      delete result[key];
    Object.assign(result, {
      R001: quantity * 2.1,
      R002: quantity * 0.5,
      R004: quantity * 0.15,
      R003: quantity * 1.1,
    });
  }
  if (localBrazing)
    Object.assign(result, { U001: quantity * 0.01, U002: quantity * 0.2 });
  return result;
}
export function mrp(
  s: GameState,
  quantity: number,
  productId = "FE-HX001",
  makeComponents = false,
) {
  const needs = requirements(
    quantity,
    productId,
    makeComponents,
    s.enterprise.policies.localBrazing,
  );
  return Object.entries(needs).map(([itemId, required]) => {
    const available = s.lots
        .filter(
          (l) =>
            l.itemId === itemId &&
            storageLocation(l.locationId) &&
            l.quality === "good",
        )
        .reduce(
          (n, l) =>
            n +
            l.quantity -
            l.reserved -
            s.enterprise.allocations
              .filter((a) => a.lotId === l.id)
              .reduce((n, a) => n + a.quantity, 0),
          0,
        ),
      incoming = s.factory.deliveries
        .filter((d) => d.itemId === itemId)
        .reduce((n, d) => n + d.quantity, 0);
    const shortage = Math.max(
      0,
      Math.round((required - available - incoming) * 1000000) / 1000000,
    );
    return {
      itemId,
      required,
      available,
      incoming,
      shortage,
      costMinor: Math.round(shortage * (PURCHASE_PRICES[itemId] ?? 0)),
    };
  });
}
export function capacity(s: GameState) {
  const steps = [
    "clean",
    "assemble",
    ...(s.enterprise.policies.localBrazing ? ["flux", "braze"] : []),
    "leak-test",
    "coat",
    "pack",
  ];
  const rows = steps.map((recipeId) => {
    const recipe = OPERATIONS.find((r) => r.id === recipeId)!;
    const count = s.factory.machines.filter(
      (m) => m.recipeId === recipeId,
    ).length;
    return { recipeId, nominalPerHour: (count * 3600) / recipe.seconds, count };
  });
  const bottleneck = rows.reduce((a, b) =>
    b.nominalPerHour < a.nominalPerHour ? b : a,
  );
  return {
    rows,
    bottleneck,
    perHour: bottleneck.nominalPerHour,
    cooperationDays: s.enterprise.policies.localBrazing ? 0 : 2,
  };
}
