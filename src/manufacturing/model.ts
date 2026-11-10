export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}
export interface Operation {
  id: string;
  machineId: string;
  name: string;
  seconds: number;
  inputs: { itemId: string; amount: number }[];
  outputs: { itemId: string; amount: number }[];
  test?: boolean;
}
export interface ProductionMachine {
  id: string;
  recipeId: string;
  enabled: boolean;
  power: boolean;
  air: boolean;
  workerId: string | null;
  due: number | null;
  reason: string;
  completed: number;
  rejected: number;
  inputCapacity: number;
  outputCapacity: number;
  powerPath: Point[];
  cycleCostMinor: number;
  cycleBatchIds: string[];
}
export interface Transfer {
  id: string;
  lotId: string;
  quantity: number;
  from: string;
  to: string;
  path: Point[];
  started: number | null;
  due: number | null;
  workerId: string | null;
}
export interface PendingDelivery {
  id: string;
  itemId: string;
  quantity: number;
  costMinor: number;
  due: number;
}
export interface Cooperation {
  id: string;
  quantity: number;
  due: number;
  batchId: string;
  costMinor: number;
}
export interface Invoice {
  id: string;
  contractId: string;
  quantity: number;
  amountMinor: number;
  due: number;
  paid: boolean;
}
export interface Contract {
  id: string;
  quantity: number;
  unitPriceMinor: number;
  deadline: number;
  paymentDays: number;
  status: "offer" | "accepted" | "shipped" | "paid";
}
export interface ScheduledEvent {
  at: number;
  seq: number;
  kind:
    | "cycle"
    | "transfer"
    | "delivery"
    | "cooperation"
    | "payment"
    | "payroll"
    | "repair";
  id: string;
}
export interface Factory {
  hall: Rect | null;
  revision: number;
  nextId: number;
  eventSeq: number;
  events: ScheduledEvent[];
  processedCommands: string[];
  machines: ProductionMachine[];
  transfers: Transfer[];
  deliveries: PendingDelivery[];
  cooperations: Cooperation[];
  invoices: Invoice[];
  contracts: Contract[];
  powerCapacityKw: number;
  storageCapacity: number;
  shipped: number;
  tested: number;
  rejected: number;
  totalTransfers: number;
  ledger: { at: number; kind: string; amountMinor: number }[];
}
export function createFactory(): Factory {
  return {
    hall: null,
    revision: 0,
    nextId: 1,
    eventSeq: 0,
    events: [],
    processedCommands: [],
    machines: [],
    transfers: [],
    deliveries: [],
    cooperations: [],
    invoices: [],
    contracts: [
      {
        id: "HX-001",
        quantity: 10,
        unitPriceMinor: 185000,
        deadline: 60 * 86400,
        paymentDays: 30,
        status: "offer",
      },
      {
        id: "HX-002",
        quantity: 25,
        unitPriceMinor: 190000,
        deadline: 90 * 86400,
        paymentDays: 30,
        status: "offer",
      },
    ],
    powerCapacityKw: 500,
    storageCapacity: 50000,
    shipped: 0,
    tested: 0,
    rejected: 0,
    totalTransfers: 0,
    ledger: [],
  };
}
