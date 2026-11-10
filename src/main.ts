import { GAME_SECONDS_PER_TICK } from "./core/time";
import { FactoryUI } from "./ui/factory";
import "./style.css";
import { FixedClock, Simulation, gameDate } from "./core/simulation";
import { SPEEDS } from "./core/model";
import { machines } from "./data/catalog";
import { PixiFactory, type FactoryRenderer } from "./render/factory";
import { SaveStore, encode, decode } from "./save/storage";
import { cs as t, money } from "./ui/text";
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `<header><div class="brand">${t.title}<small>${t.subtitle}</small></div><div class="stat"><small>${t.cash}</small><strong id="cash"></strong></div><div class="stat"><small>${t.revenue} / ${t.expenses}</small><span id="income"></span></div><div class="stat"><small>${t.employees}</small><span id="workers"></span></div><div class="time"><time id="date"></time><nav id="speeds" aria-label="Rychlost simulace"></nav></div></header><div class="workspace"><aside><span class="eyebrow">${t.scope}</span><h2>${t.map}</h2><p>${t.future}</p><section><h3>${t.catalog}</h3><p class="muted">${t.balance}</p><div id="catalog"></div></section></aside><main><div class="map-heading"><div><span class="eyebrow">100 × 70 M · GRID 1 M</span><h1 id="parcel">${t.parcel}</h1></div><span class="badge">M1</span></div><div id="map" aria-label="Mapa továrny" tabindex="0"></div><div class="camera"><button id="minus" aria-label="Oddálit">−</button><button id="plus" aria-label="Přiblížit">+</button><button id="left" aria-label="Posunout vlevo">←</button><button id="right" aria-label="Posunout vpravo">→</button><button id="up" aria-label="Posunout nahoru">↑</button><button id="down" aria-label="Posunout dolů">↓</button><button id="center">${t.reset}</button></div><p class="map-hint">${t.hint}</p></main><aside class="right"><span class="eyebrow">${t.status}</span><h2>${t.ready}</h2><p class="notice" id="production-status">${t.noProduction}</p><p>${t.empty}</p><section><h3>${t.selection}</h3><strong id="selected">—</strong><p>${t.selected}</p></section><section><h3>${t.product}</h3><p>${t.bom}</p></section><section><h3>${t.investor}</h3><p id="accounts"></p></section><section class="save-controls"><button id="save">${t.save}</button><button id="load">${t.load}</button><button id="export">${t.export}</button><label class="button" for="import">${t.import}</label><input id="import" type="file" accept="application/json,.json" hidden></section><p id="message" role="status" aria-live="polite"></p></aside></div><footer><span>WEBGL · FIXED STEP 50 MS</span><span id="metrics"></span></footer>`;
const el = (id: string) => document.getElementById(id)!;
const sim = new Simulation(),
  clock = new FixedClock(),
  store = new SaveStore();
const renderer: FactoryRenderer = new PixiFactory();
const put = (id: string, value: string) => {
  if (el(id).textContent !== value) el(id).textContent = value;
};
for (const speed of SPEEDS) {
  const b = document.createElement("button");
  b.textContent = speed ? `${speed}×` : t.pause;
  b.dataset.speed = String(speed);
  b.onclick = () => {
    sim.setSpeed(speed);
    refresh();
  };
  el("speeds").append(b);
}
for (const machine of machines) {
  const row = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = machine.name;
  const body = document.createElement("p");
  body.textContent = `${machine.id} · ${machine.footprint.width} × ${machine.footprint.height} m · ${money(machine.priceMinor)} · ${machine.ratedPowerKw} kW · ${machine.throughputPerHour} ${machine.throughputUnit}/h`;
  row.append(summary, body);
  el("catalog").append(row);
}
const factoryUI = new FactoryUI(sim, (message) => put("message", message));
function refresh() {
  factoryUI.refresh();
  renderer.update(sim.state);
  put(
    "parcel",
    sim.state.world.owned ? "Vlastní výrobní závod" : "Nezakoupený pozemek",
  );
  const s = sim.state;
  put(
    "production-status",
    `V provozu: ${s.machines.filter((m) => m.status === "running").length} / ${s.machines.length} · Přepravy: ${s.factory.transfers.length} · Expedováno: ${s.factory.shipped} ks`,
  );
  put("cash", money(s.finance.cashMinor));
  put(
    "income",
    `${money(s.finance.revenueMinor)} / ${money(s.finance.expensesMinor)}`,
  );
  put("workers", String(s.employees.length));
  put(
    "date",
    new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(gameDate(s)),
  );
  put(
    "accounts",
    `${t.receivables}: ${money(s.finance.receivablesMinor)} · ${t.payables}: ${money(s.finance.payablesMinor)} · ${t.profit}: ${money(s.finance.revenueMinor - s.finance.expensesMinor)}`,
  );
  el("speeds")
    .querySelectorAll("button")
    .forEach((b) => {
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.speed) === s.speed),
      );
    });
}
async function action(fn: () => Promise<void>) {
  const buttons = el("save").parentElement!.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    put("message", t.error + (e instanceof Error ? e.message : t.unknown));
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    refresh();
  }
}
el("save").onclick = () =>
  void action(async () => {
    await store.write(sim.state);
    put("message", t.saved);
  });
el("load").onclick = () =>
  void action(async () => {
    sim.state = await store.read();
    clock.reset();
    put("message", t.loaded);
  });
el("export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([encode(sim.state)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "factory-empire.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
el("import").onchange = () =>
  void action(async () => {
    const input = el("import") as HTMLInputElement;
    const file = input.files?.[0];
    try {
      if (!file) return;
      if (file.size > 20_000_000) throw new Error("Soubor je příliš velký.");
      const next = decode(await file.text());
      sim.state = next;
      clock.reset();
      put("message", t.imported);
    } finally {
      input.value = "";
    }
  });
refresh();
async function initRenderer() {
  try {
    await renderer.init(el("map"), (x, y) => {
      put("selected", `[${x}, ${y}]`);
      factoryUI.select(x, y);
    });
    renderer.update(sim.state);
    el("plus").onclick = () => renderer.zoom(1.2);
    el("minus").onclick = () => renderer.zoom(1 / 1.2);
    el("center").onclick = () => renderer.resetCamera();
    for (const [id, x, y] of [
      ["left", 50, 0],
      ["right", -50, 0],
      ["up", 0, 50],
      ["down", 0, -50],
    ] as const)
      el(id).onclick = () => renderer.pan(x, y);
  } catch {
    put("map", t.renderError);
  }
}
void initRenderer();
let last = performance.now(),
  uiAt = last,
  frames = 0,
  fpsAt = last,
  fps = 0,
  tickMs = 0;
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  clock.reset();
});
function frame(now: number) {
  if (!document.hidden) {
    const before = performance.now();
    const count = clock.advance(Math.max(0, now - last), sim);
    renderer.animate(
      sim.state,
      Math.max(0, sim.state.tick - 1 + clock.fraction) * GAME_SECONDS_PER_TICK,
    );
    tickMs = count ? (performance.now() - before) / count : 0;
    frames++;
    if (now - fpsAt >= 1000) {
      fps = Math.round((frames * 1000) / (now - fpsAt));
      fpsAt = now;
      frames = 0;
    }
    if (now - uiAt >= 250) {
      refresh();
      put(
        "metrics",
        `${t.fps} ${fps} · ${t.tick} ${tickMs.toFixed(3)} ms · ${t.entities} ${sim.state.machines.length + sim.state.employees.length + sim.state.lots.length} · ${t.tasks} ${sim.state.factory.transfers.length}`,
      );
      uiAt = now;
    }
  }
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
