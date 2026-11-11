import type { GameState } from "../core/model";
import { machines } from "../data/catalog";
import type { Point, Rect } from "../manufacturing/model";
export const warehouse: Point = { x: 2, y: 2 };
export function footprint(s: GameState, id: string): Rect {
  const m = s.machines.find((m) => m.id === id)!;
  const d = machines.find((d) => d.id === m.definitionId)!;
  const rotated = m.orientation === 90 || m.orientation === 270;
  return {
    x: m.x,
    y: m.y,
    width: rotated ? d.footprint.height : d.footprint.width,
    height: rotated ? d.footprint.width : d.footprint.height,
  };
}
export function contains(r: Rect, p: Point): boolean {
  return (
    p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height
  );
}
export function overlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
export function port(s: GameState, location: string): Point {
  if (location === "warehouse") return warehouse;
  const dock = s.enterprise.docks.find((d) => d.id === location);
  if (dock) return { x: dock.x, y: dock.y };
  const zone = s.enterprise.zones.find((z) => z.id === location);
  if (zone) return { x: zone.x - 1, y: zone.y };
  const id = location.split(":")[0]!;
  const r = footprint(s, id);
  return { x: r.x - 1, y: r.y };
}
const caches = new WeakMap<
  GameState,
  { revision: number; routes: Map<string, Point[] | null> }
>();
export function path(
  s: GameState,
  start: Point,
  end: Point,
  extra?: Rect,
): Point[] | null {
  if (extra) return computePath(s, start, end, extra);
  let cache = caches.get(s);
  if (!cache || cache.revision !== s.factory.revision) {
    cache = { revision: s.factory.revision, routes: new Map() };
    caches.set(s, cache);
  }
  const key = `${start.x},${start.y}:${end.x},${end.y}`;
  if (cache.routes.has(key)) return cache.routes.get(key)!;
  const result = computePath(s, start, end);
  if (cache.routes.size < 5000) cache.routes.set(key, result);
  return result;
}
export function widePath(s: GameState, start: Point, end: Point) {
  return computePath(s, start, end, undefined, true);
}
function computePath(
  s: GameState,
  start: Point,
  end: Point,
  extra?: Rect,
  wide = false,
): Point[] | null {
  const w = s.world.width,
    h = s.world.height,
    blocked = new Uint8Array(w * h);
  const obstacles = [
    ...s.machines.map((m) => footprint(s, m.id)),
    ...s.enterprise.zones,
  ];
  for (const r of obstacles) {
    for (
      let y = Math.max(0, r.y - (wide ? 1 : 0));
      y < Math.min(h, r.y + r.height);
      y++
    )
      for (
        let x = Math.max(0, r.x - (wide ? 1 : 0));
        x < Math.min(w, r.x + r.width);
        x++
      )
        blocked[y * w + x] = 1;
  }
  if (wide) {
    blocked[start.y * w + start.x] = 0;
    blocked[end.y * w + end.x] = 0;
  }
  if (extra)
    for (let y = extra.y; y < extra.y + extra.height; y++)
      for (let x = extra.x; x < extra.x + extra.width; x++)
        blocked[y * w + x] = 1;
  const valid = (p: Point) =>
    p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && !blocked[p.y * w + p.x];
  if (!valid(start) || !valid(end)) return null;
  const parent = new Int32Array(w * h).fill(-1),
    queue = new Int32Array(w * h);
  let read = 0,
    write = 0;
  const first = start.y * w + start.x,
    last = end.y * w + end.x;
  queue[write++] = first;
  parent[first] = first;
  while (read < write) {
    const at = queue[read++]!;
    if (at === last) break;
    const x = at % w,
      y = Math.floor(at / w);
    for (const p of [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ]) {
      const n = p.y * w + p.x;
      if (valid(p) && parent[n] === -1) {
        parent[n] = at;
        queue[write++] = n;
      }
    }
  }
  if (parent[last] === -1) return null;
  const result: Point[] = [];
  for (let at = last; ; at = parent[at]!) {
    result.push({ x: at % w, y: Math.floor(at / w) });
    if (at === first) break;
  }
  return result.reverse();
}
