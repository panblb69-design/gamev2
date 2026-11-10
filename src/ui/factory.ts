import { FactoryEngine, type FactoryCommand } from "../manufacturing/engine";
import { OPERATIONS, COSTS, PURCHASE_PRICES } from "../manufacturing/catalog";
import { items, machines } from "../data/catalog";
import type { Simulation } from "../core/simulation";
import { money } from "./text";
export class FactoryUI {
  private placement: string | null = null;
  private rotation: 0 | 90 = 0;
  private selectedId: string | null = null;
  private counter = 0;
  private session = crypto.randomUUID();
  private lastAction = { key: "", at: 0 };
  constructor(
    private sim: Simulation,
    private notify: (message: string) => void,
  ) {
    this.build();
  }
  private el(id: string) {
    return document.getElementById(id)!;
  }
  private run(c: FactoryCommand, key = JSON.stringify(c)) {
    // Reuse the command ID for accidental double-clicks; core also deduplicates it.
    const now = performance.now();
    if (this.lastAction.key === key && now - this.lastAction.at < 600) return;
    try {
      new FactoryEngine(this.sim.state).command(
        `${this.session}:${++this.counter}`,
        c,
      );
      this.notify("Příkaz proveden.");
      this.lastAction = { key, at: now };
      this.refresh();
    } catch (e) {
      this.notify(e instanceof Error ? e.message : "Příkaz se nezdařil.");
    }
  }
  private button(
    parent: HTMLElement,
    label: string,
    fn: () => void,
    id?: string,
  ) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    if (id) b.id = id;
    parent.append(b);
    return b;
  }
  private build() {
    const build = document.createElement("section");
    build.innerHTML =
      '<h3>Výstavba</h3><p>Nejdříve kupte pozemek a postavte halu. Vyberte stroj v katalogu a klikněte na mapu.</p><div id="construction"></div><label>Hala x,y,šířka,výška <input id="hall-rect" value="5,5,88,58" aria-label="Rozměry haly"></label><p id="placement-mode"></p>';
    document.querySelector("aside")!.prepend(build);
    const box = this.el("construction");
    this.button(
      box,
      `Koupit pozemek · ${money(COSTS.land)}`,
      () => this.run({ type: "buy-land" }),
      "buy-land",
    );
    this.button(
      box,
      "Postavit halu",
      () => {
        const [x, y, width, height] = (
          this.el("hall-rect") as HTMLInputElement
        ).value
          .split(",")
          .map(Number);
        if ([x, y, width, height].some((n) => n === undefined)) {
          this.notify("Zadejte čtyři čísla.");
          return;
        }
        this.run({
          type: "build-hall",
          rect: { x: x!, y: y!, width: width!, height: height! },
        });
      },
      "build-hall",
    );
    this.button(box, "Otočit 90°", () => {
      this.rotation = this.rotation === 0 ? 90 : 0;
      this.mode();
    });
    this.button(box, "Zrušit výběr", () => {
      this.placement = null;
      this.mode();
    });
    const catalog = this.el("catalog");
    catalog.querySelectorAll("details").forEach((row, i) => {
      const d = machines[i];
      if (d && OPERATIONS.some((r) => r.machineId === d.id))
        this.button(row as HTMLElement, "Umístit", () => {
          this.placement = d.id;
          this.mode();
        });
    });
    const right = document.querySelector(".right")!;
    const context = document.createElement("section");
    context.innerHTML =
      '<h3>Vybraný stroj</h3><p id="machine-info">Klikněte na stroj v mapě.</p><div id="machine-actions"></div>';
    right.prepend(context);
    const operations = document.createElement("section");
    operations.innerHTML = `<h3>Provoz</h3><div id="hire"></div><p id="staff"></p><h3>Nákup materiálu</h3><select id="buy-item" aria-label="Materiál">${Object.keys(
      PURCHASE_PRICES,
    )
      .map(
        (id) =>
          `<option value="${id}">${items.find((i) => i.id === id)!.name}</option>`,
      )
      .join(
        "",
      )}</select><input id="buy-quantity" aria-label="Množství materiálu" type="number" min="0.001" max="10000" step="0.001" value="56"><div id="buy-actions"></div><h3>Sklad a dodávky</h3><div id="inventory"></div><h3>Kooperace tavidlo + CAB</h3><input id="coop-quantity" aria-label="Počet jader do kooperace" type="number" min="1" max="1000" value="1"><div id="coop-actions"></div><p id="cooperation"></p><h3>Zakázky</h3><div id="contracts"></div>`;
    right.append(operations);
    this.button(this.el("hire"), "Najmout operátora", () =>
      this.run({ type: "hire", role: "operator" }),
    );
    this.button(this.el("hire"), "Najmout skladníka", () =>
      this.run({ type: "hire", role: "warehouse" }),
    );
    this.button(this.el("hire"), "Najmout údržbáře", () =>
      this.run({ type: "hire", role: "mechanic" }),
    );
    this.button(this.el("buy-actions"), "Objednat (dodání 4 h)", () =>
      this.run({
        type: "buy",
        itemId: (this.el("buy-item") as HTMLSelectElement).value,
        quantity: Number((this.el("buy-quantity") as HTMLInputElement).value),
      }),
    );
    this.button(this.el("coop-actions"), "Odeslat jádra (2 dny)", () =>
      this.run({
        type: "cooperate",
        quantity: Number((this.el("coop-quantity") as HTMLInputElement).value),
      }),
    );
    const guide = document.createElement("details");
    guide.innerHTML =
      "<summary>Jak vyrobit první výparník</summary><p>1. Pozemek → hala → skladník a operátoři.<br>2. Umístěte mytí, montáž, heliový tester, povrchovou úpravu a balení (mezi stroji nechte uličku).<br>3. Každému připojte elektřinu a vzduch, přiřaďte operátora a zapněte výrobu.<br>4. Nakupte 56 desek, 27 lamel, 2 výztuhy, vstupní a výstupní trubku, blok; dále vodu (4 l/kus), čistič (.01 l), helium (.001 m³), chemii (.01 l), 2 záslepky a obal.<br>5. Po dodání skladník dopraví vstupy k mytí. Očištěná sada → montáž → jádro do skladu. Pošlete jej do kooperace.<br>6. Za 2 dny se vrátí pájené jádro: test → povrch → balení. Neshodný kus jde do karantény. Při poruše najměte údržbáře, nakupte sadu náhradních dílů a v kontextu stroje spusťte opravu.<br>7. Přijměte zakázku, vyrobte celé množství a expedujte. Inkaso až 30 dní po expedici.<br>Volitelně vyrábějte komponenty ze surovin na lisu, lamelovacím a trubkovém stroji. Na jednu sadu: 2.1 kg pájecího svitku, .5 kg pásu, .15 kg plechu a 1.1 m trubky. Časy a spotřeby jsou neověřené herní hodnoty.</p>";
    document.querySelector("aside")!.prepend(guide);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.placement = null;
        this.mode();
      }
    });
    this.refresh();
  }
  private mode() {
    this.el("placement-mode").textContent = this.placement
      ? `Umístění ${this.placement} · ${this.rotation}° · klikněte na mapu`
      : "Režim výběru";
  }
  select(x: number, y: number) {
    if (this.placement) {
      this.run({
        type: "place",
        definitionId: this.placement,
        x,
        y,
        orientation: this.rotation,
      });
      return;
    }
    const s = this.sim.state;
    const found = s.machines.find((m) => {
      const d = machines.find((d) => d.id === m.definitionId)!;
      const w = m.orientation === 90 ? d.footprint.height : d.footprint.width,
        h = m.orientation === 90 ? d.footprint.width : d.footprint.height;
      return x >= m.x && x < m.x + w && y >= m.y && y < m.y + h;
    });
    this.selectedId = found?.id ?? null;
    this.renderContext();
    if (found) document.querySelector(".right")!.scrollTop = 0;
  }
  private renderContext() {
    const s = this.sim.state,
      m = s.factory.machines.find((m) => m.id === this.selectedId),
      actions = this.el("machine-actions");
    const signature = JSON.stringify([
      m,
      s.employees.map((w) => w.id),
      s.factory.machines.map((m) => m.workerId),
      s.machines.find((x) => x.id === m?.id)?.status,
    ]);
    if (actions.dataset.signature === signature) return;
    actions.dataset.signature = signature;
    actions.replaceChildren();
    if (!m) {
      this.el("machine-info").textContent = "Klikněte na stroj v mapě.";
      return;
    }
    const placed = s.machines.find((x) => x.id === m.id)!,
      d = machines.find((x) => x.id === placed.definitionId)!;
    this.el("machine-info").textContent =
      `${d.name} · ${m.id}: ${m.reason} Hotovo ${m.completed}, neshodné ${m.rejected}. Elektřina ${m.power ? "ano" : "ne"}, vzduch ${m.air ? "ano" : "ne"}. Operátor ${m.workerId ?? "nepřiřazen"}.`;
    if (placed.status === "fault")
      this.button(actions, "Opravit (díl + údržbář)", () =>
        this.run({ type: "repair", machineId: m.id }),
      );
    for (const utility of ["power", "air"] as const)
      if (!m[utility])
        this.button(
          actions,
          utility === "power" ? "Připojit elektřinu" : "Připojit vzduch",
          () => this.run({ type: "connect", machineId: m.id, utility }),
        );
    if (!m.workerId) {
      const worker = s.employees.find(
        (w) =>
          w.role === "operator" &&
          !s.factory.machines.some((x) => x.workerId === w.id),
      );
      if (worker)
        this.button(actions, "Přiřadit volného operátora", () =>
          this.run({ type: "assign", machineId: m.id, workerId: worker.id }),
        );
    }
    for (const r of OPERATIONS.filter((r) => r.machineId === d.id))
      this.button(
        actions,
        `${m.enabled && m.recipeId === r.id ? "Zastavit" : "Spustit"}: ${r.name}`,
        () =>
          this.run({
            type: "configure",
            machineId: m.id,
            recipeId: r.id,
            enabled: !(m.enabled && m.recipeId === r.id),
          }),
      );
  }
  refresh() {
    const s = this.sim.state,
      e = new FactoryEngine(s);
    this.el("staff").textContent =
      `${s.employees.filter((w) => w.role === "operator").length} operátorů · ${s.employees.filter((w) => w.role === "warehouse").length} skladníků · denní mzdy ${money(s.employees.reduce((n, w) => n + w.wageMinor, 0))}`;
    const stock = items
      .map((i) => {
        const n = e.stock(i.id);
        return n > 0 ? `${i.name}: ${n} ${i.unit}` : "";
      })
      .filter(Boolean);
    this.el("inventory").textContent =
      [
        ...stock,
        ...s.factory.deliveries.map(
          (d) => `Na cestě: ${d.itemId} × ${d.quantity}`,
        ),
        ...s.lots
          .filter((l) => l.quality === "quarantine")
          .map((l) => `Karanténa: ${l.quantity} ks`),
      ].join(" · ") || "Sklad je prázdný.";
    this.el("cooperation").textContent =
      `Jádra ve skladu: ${e.stock("W001")} · V kooperaci: ${s.factory.cooperations.reduce((n, c) => n + c.quantity, 0)} · Testováno: ${s.factory.tested} · Neshodné: ${s.factory.rejected}`;
    const contracts = this.el("contracts");
    const signature = JSON.stringify(s.factory.contracts);
    if (contracts.dataset.signature !== signature) {
      contracts.dataset.signature = signature;
      contracts.replaceChildren();
      for (const c of s.factory.contracts) {
        const p = document.createElement("p");
        p.textContent = `${c.id} · ${c.quantity} ks × ${money(c.unitPriceMinor)} · ${c.status} · splatnost ${c.paymentDays} dní`;
        contracts.append(p);
        if (c.status === "offer")
          this.button(contracts, "Přijmout " + c.id, () =>
            this.run({ type: "accept", contractId: c.id }),
          );
        if (c.status === "accepted")
          this.button(contracts, "Expedovat " + c.id, () =>
            this.run({ type: "ship", contractId: c.id }),
          );
      }
    }
    this.renderContext();
  }
}
