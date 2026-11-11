import type { Employee, GameState } from "../core/model";
export const shifts = {
  continuous: [0, 24],
  morning: [6, 14],
  afternoon: [14, 22],
  night: [22, 30],
} as const;
export function onShift(
  s: GameState,
  worker: Employee | undefined,
  now: number,
  duration = 0,
  skill?: string,
): boolean {
  if (!worker?.available) return false;
  const p = s.enterprise.workerProfiles[worker.id];
  if (!p) return skill !== "CAB";
  if (
    now < p.trainingUntil ||
    now < p.absenceUntil ||
    (skill && !p.skills.includes(skill))
  )
    return false;
  if (p.shift === "continuous") return true;
  const range = shifts[p.shift];
  let hour = (now / 3600) % 24;
  if (p.shift === "night" && hour < 6) hour += 24;
  return hour >= range[0] && hour + duration / 3600 <= range[1];
}
export const requiredSkill = (definitionId: string) =>
  definitionId === "M009"
    ? "CAB"
    : definitionId === "M011"
      ? "quality"
      : definitionId === "M007"
        ? "assembly"
        : "operation";
export function nextShift(
  s: GameState,
  worker: Employee | undefined,
  now: number,
): number {
  const shift = worker && s.enterprise.workerProfiles[worker.id]?.shift;
  if (!shift || shift === "continuous") return now;
  const start = shifts[shift][0] * 3600,
    day = Math.floor(now / 86400) * 86400;
  return day + start > now ? day + start : day + 86400 + start;
}
