import type { ScheduledEvent } from "./model";
const before = (a: ScheduledEvent, b: ScheduledEvent) =>
  a.at < b.at || (a.at === b.at && a.seq < b.seq);
export function push(heap: ScheduledEvent[], event: ScheduledEvent): void {
  heap.push(event);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!before(heap[i]!, heap[p]!)) break;
    [heap[i], heap[p]] = [heap[p]!, heap[i]!];
    i = p;
  }
}
export function pop(heap: ScheduledEvent[]): ScheduledEvent | undefined {
  const first = heap[0],
    last = heap.pop();
  if (heap.length && last) {
    heap[0] = last;
    let i = 0;
    while (true) {
      let child = i * 2 + 1;
      if (child >= heap.length) break;
      if (child + 1 < heap.length && before(heap[child + 1]!, heap[child]!))
        child++;
      if (!before(heap[child]!, heap[i]!)) break;
      [heap[i], heap[child]] = [heap[child]!, heap[i]!];
      i = child;
    }
  }
  return first;
}
