import type { Factory } from "../manufacturing/model";
export type Unit = "ks" | "kg" | "m" | "l" | "m³" | "kWh";
export interface Quantity {
  itemId: string;
  amount: number;
  unit: Unit;
}
export interface Item {
  id: string;
  name: string;
  unit: Unit;
  kind: "raw" | "component" | "wip" | "product" | "medium" | "waste";
}
export interface Recipe {
  id: string;
  version: number;
  inputs: Quantity[];
  outputs: Quantity[];
  cycleSeconds: number;
  machineId: string;
  verified: false;
}
export type MachineStatus =
  | "unplaced"
  | "placed"
  | "installing"
  | "waiting_for_utilities"
  | "idle"
  | "running"
  | "starved"
  | "blocked"
  | "changeover"
  | "maintenance"
  | "fault";
export interface MachineDefinition {
  id: string;
  name: string;
  category: string;
  footprint: { width: number; height: number };
  ports: { kind: "input" | "output" | "utility"; x: number; y: number }[];
  priceMinor: number;
  installationSeconds: number | null;
  ratedPowerKw: number;
  activePowerFactor: number | null;
  media: { air: number | null; water: number | null; nitrogen: number | null };
  requiredWorkers: number;
  requiredSkills: string[];
  supportedRecipes: string[];
  throughputPerHour: number;
  throughputUnit: string;
  inputBuffer: number | null;
  outputBuffer: number | null;
  maintenanceRules: string[];
  faultProfile: string[];
  qualityParameters: { yield: number | null };
  operatingCostMinorPerHour: number | null;
}
export interface MachineInstance {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  orientation: 0 | 90 | 180 | 270;
  status: MachineStatus;
  condition: number;
}
export interface InventoryLot {
  id: string;
  itemId: string;
  quantity: number;
  reserved: number;
  locationId: string;
  quality: "unchecked" | "good" | "quarantine" | "scrap";
  batchId: string;
  costMinor: number;
}
export interface Employee {
  id: string;
  role: string;
  skills: string[];
  wageMinor: number;
  shiftId: string;
  available: boolean;
}
export interface LogisticsTask {
  id: string;
  lotId: string;
  from: string;
  to: string;
  quantity: number;
  status: "queued" | "assigned" | "moving" | "done";
}
export interface Finance {
  cashMinor: number;
  receivablesMinor: number;
  payablesMinor: number;
  revenueMinor: number;
  expensesMinor: number;
  investorShare: number;
}
export const SPEEDS = [0, 1, 2, 5, 10] as const;
export type Speed = (typeof SPEEDS)[number];
export interface GameState {
  schemaVersion: 2;
  factory: Factory;
  tick: number;
  rngState: number;
  speed: Speed;
  world: { width: number; height: number; owned: boolean };
  finance: Finance;
  machines: MachineInstance[];
  lots: InventoryLot[];
  employees: Employee[];
  logisticsTasks: LogisticsTask[];
}
