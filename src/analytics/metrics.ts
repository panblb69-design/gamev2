import type { GameState } from "../core/model";
export function recordState(
  s: GameState,
  id: string,
  state: string,
  now: number,
) {
  const all = s.enterprise.metrics;
  const m =
    all[id] ??
    (all[id] = {
      lastAt: now,
      state,
      times: {},
      idealSeconds: 0,
      cycles: 0,
      good: 0,
      failures: 0,
    });
  m.times[m.state] = (m.times[m.state] ?? 0) + Math.max(0, now - m.lastAt);
  m.lastAt = now;
  m.state = state;
}
export function oee(s: GameState, id: string, now: number) {
  const m = s.enterprise.metrics[id];
  if (!m) return { availability: 0, performance: 0, quality: 0, oee: 0 };
  const times = { ...m.times };
  times[m.state] = (times[m.state] ?? 0) + Math.max(0, now - m.lastAt);
  const planned =
      Object.values(times).reduce((n, v) => n + v, 0) - (times.idle ?? 0),
    run = times.running ?? 0;
  const availability = planned > 0 ? run / planned : 0,
    performance = run > 0 ? Math.min(1, m.idealSeconds / run) : 0,
    quality = m.cycles > 0 ? m.good / m.cycles : 0;
  return {
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
  };
}
export function financialReport(s: GameState) {
  const inventoryMinor =
    s.lots.reduce((n, l) => n + l.costMinor, 0) +
    s.factory.machines.reduce((n, m) => n + m.cycleCostMinor, 0) +
    s.factory.deliveries.reduce((n, d) => n + d.costMinor, 0) +
    s.factory.cooperations.reduce((n, c) => n + c.costMinor, 0);
  return {
    inventoryMinor,
    profitMinor: s.finance.revenueMinor - s.finance.expensesMinor,
    receivablesMinor: s.finance.receivablesMinor,
    cashMinor: s.finance.cashMinor,
    payablesMinor: s.finance.payablesMinor,
  };
}
