export const ROLES = {
  operator: {
    name: "Operátor",
    skills: ["operation", "assembly", "quality"],
    wageMinor: 180000,
  },
  assembler: { name: "Montážník", skills: ["assembly"], wageMinor: 170000 },
  quality: { name: "Kontrolor", skills: ["quality"], wageMinor: 200000 },
  technologist: {
    name: "Technolog",
    skills: ["CAB", "operation"],
    wageMinor: 300000,
  },
  warehouse: { name: "Skladník", skills: ["forklift"], wageMinor: 160000 },
  mechanic: { name: "Mechanik", skills: ["maintenance"], wageMinor: 220000 },
  technician: {
    name: "Elektrotechnik",
    skills: ["maintenance", "operation"],
    wageMinor: 250000,
  },
  setter: { name: "Seřizovač", skills: ["operation"], wageMinor: 240000 },
  planner: { name: "Plánovač", skills: [], wageMinor: 240000 },
  buyer: { name: "Nákupčí", skills: [], wageMinor: 230000 },
  sales: { name: "Obchodník", skills: [], wageMinor: 240000 },
  manager: { name: "Vedoucí", skills: [], wageMinor: 400000 },
} as const;
export type EmployeeRole = keyof typeof ROLES;
export const productionRole = (role: string) =>
  [
    "operator",
    "assembler",
    "quality",
    "technologist",
    "technician",
    "setter",
  ].includes(role);
