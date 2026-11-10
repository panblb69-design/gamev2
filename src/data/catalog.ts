import type { Item, MachineDefinition, Quantity, Recipe } from "../core/model";
const componentNames = [
  "Lisovaná hliníková deska",
  "Zvlněná lamelová vložka",
  "Boční výztuha",
  "Vstupní Al trubka",
  "Výstupní Al trubka",
  "Připojovací blok",
  "Ochranná záslepka",
  "Obalová sada",
];
export const items: Item[] = componentNames.map((name, i) => ({
  id: `C00${i + 1}`,
  name,
  unit: "ks",
  kind: "component",
}));
for (const [id, name, unit] of [
  ["R001", "Al pájecí svitek", "kg"],
  ["R002", "Tenký Al pás", "kg"],
  ["R003", "Al trubka", "m"],
  ["R004", "Al plech výztuh", "kg"],
  ["U001", "Tavidlo", "kg"],
  ["U002", "Dusík", "m³"],
  ["U003", "Helium", "m³"],
  ["U004", "Voda", "l"],
  ["U005", "Čisticí prostředek", "l"],
  ["U006", "Chemie povrchové úpravy", "l"],
  ["U007", "Elektřina", "kWh"],
  ["U008", "Stlačený vzduch", "m³"],
] as const)
  items.push({ id, name, unit, kind: id.startsWith("R") ? "raw" : "medium" });
for (const [id, name] of [
  ["W001", "Sestavené jádro"],
  ["W002", "Čisté komponenty — sada"],
  ["W003", "Jádro s tavidlem"],
  ["W004", "Pájené jádro"],
  ["W005", "Těsné jádro"],
  ["W006", "Upravené jádro"],
] as const)
  items.push({ id, name, unit: "ks", kind: "wip" });
items.push({
  id: "FE-HX001",
  name: "Zabalený výparník FE-HX001",
  unit: "ks",
  kind: "product",
});
const q = (itemId: string, amount: number): Quantity => ({
  itemId,
  amount,
  unit: "ks",
});
export const product = {
  id: "FE-HX001",
  version: 1,
  bom: [56, 27, 2, 1, 1, 1, 2, 1].map((n, i) => q(`C00${i + 1}`, n)),
  design: {
    widthMm: 200,
    heightMm: 230,
    depthMm: 40,
    platePairs: 28,
    finInserts: 27,
  },
  verified: false,
};
export const recipes: Recipe[] = [
  {
    id: "assemble-core",
    version: 1,
    inputs: product.bom.slice(0, 6),
    outputs: [q("W001", 1)],
    cycleSeconds: 240,
    machineId: "M007",
    verified: false,
  },
  {
    id: "pack",
    version: 1,
    inputs: [q("W006", 1), q("C007", 2), q("C008", 1)],
    outputs: [q("FE-HX001", 1)],
    cycleSeconds: 60,
    machineId: "M012",
    verified: false,
  },
];
const rows = [
  ["M001", "Lisovací sestava", 13, 5, 70, 26, 4800, "desek", "operátor"],
  [
    "M002",
    "Podavač (součást sestavy M001)",
    0,
    0,
    0,
    0,
    4800,
    "desek",
    "operátor",
  ],
  [
    "M003",
    "Odvíječ (součást sestavy M001)",
    0,
    0,
    0,
    0,
    4800,
    "desek",
    "operátor",
  ],
  ["M004", "Lamelovací automat", 6, 3, 15, 9, 4200, "vložek", "operátor"],
  ["M005", "Dělení a ohýbání trubek", 5, 3, 14, 5, 45, "párů", "operátor"],
  ["M006", "Mytí komponentů", 7, 3, 35, 4, 50, "sad", "operátor"],
  ["M007", "Montážní pracoviště", 4, 4, 2, 4, 15, "jader", "montážník"],
  ["M008", "Tavidlová linka a sušení", 8, 3, 50, 7, 50, "jader", "operátor"],
  ["M009", "CAB pec s chlazením", 28, 5, 300, 60, 36, "jader", "technolog"],
  ["M010", "Hydrofilní úprava", 15, 4, 65, 12, 50, "jader", "operátor"],
  ["M011", "Heliový tester", 4, 3, 8, 8, 40, "jader", "kontrolor"],
  ["M012", "Finální kontrola a balení", 4, 3, 5, 2, 60, "jader", "balič"],
] as const;
// M001–M003 in the brief denotes a combined unwinder/feed/press workstation.
export const machines: MachineDefinition[] = rows
  .filter((r) => r[0] !== "M002" && r[0] !== "M003")
  .map(([id, name, width, height, power, price, rate, unit, skill]) => ({
    id,
    name,
    category: "manufacturing",
    footprint: { width, height },
    ports: [
      { kind: "input", x: 0, y: 1 },
      { kind: "output", x: width, y: 1 },
      { kind: "utility", x: 1, y: 0 },
    ],
    priceMinor: price * 100_000_000,
    installationSeconds: null,
    ratedPowerKw: power,
    activePowerFactor: null,
    media: { air: null, water: null, nitrogen: null },
    requiredWorkers: 1,
    requiredSkills: [skill],
    supportedRecipes: recipes
      .filter((r) => r.machineId === id)
      .map((r) => r.id),
    throughputPerHour: rate,
    throughputUnit: unit,
    inputBuffer: null,
    outputBuffer: null,
    maintenanceRules: [],
    faultProfile: [],
    qualityParameters: { yield: null },
    operatingCostMinorPerHour: null,
  }));
export const balance = {
  verified: false,
  constructionMinor: 14_900_000_000,
  starterTechnologyMinor: 7_400_000_000,
  reserveMinor: 7_700_000_000,
  unitSaleMinor: 185000,
  unitAllocatedCostMinor: 148000,
};
items.push(
  { id: "SCRAP-AL", name: "Hliníkový odpad", unit: "kg", kind: "waste" },
  { id: "SCRAP-TUBE", name: "Odřezky trubek", unit: "m", kind: "waste" },
);

items.push({
  id: "SPARE",
  name: "Sada náhradních dílů",
  unit: "ks",
  kind: "component",
});
