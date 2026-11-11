import { machines } from "../data/catalog";
import { OPERATIONS } from "../manufacturing/catalog";
import type { GameState } from "../core/model";
import type { Operation } from "../manufacturing/model";
import type { Enterprise } from "../enterprise/state";
export type UtilityKind = Enterprise["utilities"][number]["kind"];
export function demands(
  recipe: Operation,
): Partial<Record<UtilityKind, number>> {
  return {
    air: recipe.machineId === "M009" ? 0 : 2,
    ...(recipe.machineId === "M006" || recipe.machineId === "M010"
      ? { water: 2, exhaust: 1 }
      : {}),
    ...(recipe.machineId === "M008" ? { exhaust: 2 } : {}),
    ...(recipe.machineId === "M009"
      ? { nitrogen: 4, water: 3, exhaust: 5 }
      : {}),
  };
}
export function utilityReady(
  s: GameState,
  machineId: string,
  kind: UtilityKind,
  amount: number,
): boolean {
  const links = s.enterprise.links.filter(
    (l) => l.machineId === machineId && l.kind === kind,
  );
  // Legacy M1 installations use the paid power/air connector until rewired.
  if (!links.length && (kind === "air" || kind === "power")) {
    const m = s.factory.machines.find((m) => m.id === machineId);
    return (
      !!m?.[kind] &&
      s.enterprise.utilities.some(
        (u) => u.kind === kind && u.enabled && u.capacity >= amount,
      )
    );
  }
  return links.some((l) => {
    const source = s.enterprise.utilities.find(
      (u) => u.id === l.sourceId && u.kind === kind && u.enabled,
    );
    if (!source) return false;
    const occupied = s.factory.machines
      .filter(
        (m) =>
          m.due !== null &&
          m.id !== machineId &&
          s.enterprise.links.some(
            (other) => other.machineId === m.id && other.sourceId === source.id,
          ),
      )
      .reduce((n, m) => {
        const recipe = OPERATIONS.find((r) => r.id === m.recipeId)!,
          placed = s.machines.find((x) => x.id === m.id)!;
        return (
          n +
          (kind === "power"
            ? machines.find((d) => d.id === placed.definitionId)!.ratedPowerKw
            : (demands(recipe)[kind] ?? 0))
        );
      }, 0);
    return occupied + amount <= source.capacity;
  });
}
