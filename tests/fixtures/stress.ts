import { createGame } from "../../src/core/simulation";
export function stressState() {
  const state = createGame(42);
  state.world.owned = true;
  state.factory.hall = { x: 5, y: 5, width: 88, height: 58 };
  state.factory.powerCapacityKw = 5000;
  state.enterprise.utilities[0]!.capacity = 5000;
  state.finance.cashMinor = 100000000000; // Explicit performance scenario budget, not the player start state.
  for (let i = 0; i < 200; i++)
    state.employees.push({
      id: `worker-${i + 1}`,
      role: i < 144 ? "operator" : "warehouse",
      skills: [],
      wageMinor: 180000,
      shiftId: "continuous",
      available: true,
    });
  let seq = 201;
  for (let i = 0; i < 144; i++) {
    const id = `machine-${seq++}`;
    state.machines.push({
      id,
      definitionId: "M012",
      x: 6 + (i % 12) * 7,
      y: 6 + Math.floor(i / 12) * 4,
      orientation: 0,
      status: "idle",
      condition: 1,
    });
    state.factory.machines.push({
      id,
      recipeId: "pack",
      enabled: true,
      power: true,
      air: true,
      workerId: `worker-${i + 1}`,
      due: null,
      reason: "",
      completed: 0,
      rejected: 0,
      inputCapacity: 5000,
      outputCapacity: 120,
      powerPath: [],
      cycleCostMinor: 0,
      cycleBatchIds: [],
    });
    for (const [itemId, quantity] of [
      ["W006", 20],
      ["C007", 40],
      ["C008", 20],
    ] as const)
      state.lots.push({
        id: `lot-${seq++}`,
        itemId,
        quantity,
        reserved: 0,
        locationId: `${id}:in`,
        quality: "good",
        batchId: `source-${seq}`,
        costMinor: 10000,
      });
  }
  for (let i = state.lots.length; i < 5000; i++)
    state.lots.push({
      id: `lot-${seq++}`,
      itemId: "R001",
      quantity: 0.01,
      reserved: 0,
      locationId: "warehouse",
      quality: "good",
      batchId: `source-${seq}`,
      costMinor: 1,
    });
  state.factory.nextId = seq;

  return state;
}
