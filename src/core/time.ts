export const CONFIG = {
  stepMs: 50,
  realSecondsPerDay: 120,
  startDateMs: Date.UTC(2026, 0, 1),
  initialCashMinor: 30_000_000_000,
} as const;

export const GAME_SECONDS_PER_TICK =
  (CONFIG.stepMs / (CONFIG.realSecondsPerDay * 1000)) * 86400;
