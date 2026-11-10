import { ROLES, type EmployeeRole } from "../workforce/roles";
import { GAME_SECONDS_PER_TICK } from "../core/time";
import type { Simulation } from "../core/simulation";
import { type FactoryCommand } from "../manufacturing/engine";
import { items } from "../data/catalog";
import { usage } from "../logistics/warehouse";
import { capacity, mrp, PRODUCTS } from "../planning/planner";
import { RESEARCH } from "../automation/research";
import { financialReport, oee } from "../analytics/metrics";
import { onShift } from "../workforce/calendar";
import { money } from "./text";
type Field = {
  id: string;
  label: string;
  value?: string;
  type?: "number" | "text" | "select" | "checkbox";
  options?: [string, string][];
  min?: number;
  max?: number;
  step?: string;
};
const fmt = (n: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(n);
const labels: Record<string, string> = {
  manual: "Ruční vozík",
  forklift: "VZV",
  agv: "AGV",
  conveyor: "Dopravník",
  continuous: "Nepřetržitá",
  morning: "Ranní 6–14",
  afternoon: "Odpolední 14–22",
  night: "Noční 22–6",
  power: "Elektřina (kW)",
  air: "Vzduch",
  water: "Voda",
  nitrogen: "Dusík",
  exhaust: "Odsávání",
  operation: "Obsluha",
  assembly: "Montáž",
  quality: "Kontrola kvality",
  CAB: "Technologie CAB",
  maintenance: "Údržba",
  raw: "Suroviny",
  wip: "Rozpracovanost",
  finished: "Výrobky",
  quarantine: "Karanténa",
  mixed: "Smíšený sklad",
};
export class EnterpriseUI {
  private dialog: HTMLDialogElement;
  private selects = new Map<string, HTMLSelectElement>();
  private lastCommand = { key: "", at: 0 };
  private counter = 0;
  private session = crypto.randomUUID();
  private active = "warehouses";
  constructor(
    private sim: Simulation,
    private notify: (text: string) => void,
  ) {
    this.dialog = document.createElement("dialog");
    this.dialog.id = "management";
    this.dialog.innerHTML =
      '<div class="management-heading"><h2>Řízení závodu</h2><button id="close-management">Zavřít</button></div><nav id="management-tabs" aria-label="Přehledy závodu"></nav><div id="management-body"></div><p id="management-message" role="status"></p>';
    document.body.append(this.dialog);
    this.dialog
      .querySelector("#close-management")!
      .addEventListener("click", () => this.dialog.close());
    const open = document.createElement("button");
    open.id = "open-management";
    open.textContent = "Řízení závodu";
    open.onclick = () => {
      this.dialog.showModal();
      this.refresh();
    };
    document.querySelector(".brand")!.after(open);
    const tabs: [string, string][] = [
      ["warehouses", "Sklady a doprava"],
      ["planning", "Plánování a obchod"],
      ["workforce", "Lidé a údržba"],
      ["utilities", "Rozvody a kvalita"],
      ["automation", "Automatizace a MES"],
    ];
    for (const [id, label] of tabs) {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = () => {
        this.active = id;
        this.show();
        this.refresh();
      };
      this.dialog.querySelector("#management-tabs")!.append(button);
      const panel = document.createElement("section");
      panel.id = "panel-" + id;
      panel.className = "management-panel";
      this.dialog.querySelector("#management-body")!.append(panel);
    }
    this.warehouses();
    this.planning();
    this.workforce();
    this.utilities();
    this.automation();
    this.show();
  }
  private el(id: string) {
    return this.dialog.querySelector<HTMLElement>("#" + id)!;
  }
  private async run(c: FactoryCommand) {
    const key = JSON.stringify(c),
      at = performance.now();
    if (this.lastCommand.key === key && at - this.lastCommand.at < 600) return;
    this.lastCommand = { key, at };
    try {
      await this.sim.command(`${this.session}:${++this.counter}`, c);
      this.el("management-message").textContent = "Příkaz proveden.";
      this.notify("Příkaz proveden.");
      this.refresh();
    } catch (e) {
      this.lastCommand = { key: "", at: 0 };
      this.el("management-message").textContent =
        e instanceof Error ? e.message : "Operace se nezdařila.";
    }
  }
  private show() {
    this.dialog
      .querySelectorAll<HTMLElement>(".management-panel")
      .forEach((p) => (p.hidden = p.id !== "panel-" + this.active));
    this.dialog
      .querySelectorAll<HTMLButtonElement>("#management-tabs button")
      .forEach((b, i) =>
        b.setAttribute(
          "aria-pressed",
          String(
            ["warehouses", "planning", "workforce", "utilities", "automation"][
              i
            ] === this.active,
          ),
        ),
      );
  }
  private box(panel: string, title: string, text?: string) {
    const box = document.createElement("article");
    const h = document.createElement("h3");
    h.textContent = title;
    box.append(h);
    if (text) {
      const p = document.createElement("p");
      p.textContent = text;
      box.append(p);
    }
    this.el("panel-" + panel).append(box);
    return box;
  }
  private out(box: HTMLElement, id: string) {
    const output = document.createElement("div");
    output.id = id;
    output.className = "report";
    box.append(output);
  }
  private form(
    box: HTMLElement,
    label: string,
    fields: Field[],
    fn: (values: Record<string, string>) => void,
  ) {
    const form = document.createElement("form");
    form.className = "management-form";
    for (const f of fields) {
      const wrapper = document.createElement("label");
      wrapper.textContent = f.label;
      const control =
        f.type === "select"
          ? document.createElement("select")
          : document.createElement("input");
      control.id = f.id;
      control.name = f.id;
      control.setAttribute("aria-label", f.label);
      if (control instanceof HTMLInputElement) {
        control.type = f.type === "checkbox" ? "checkbox" : (f.type ?? "text");
        if (f.min !== undefined) control.min = String(f.min);
        if (f.max !== undefined) control.max = String(f.max);
        if (f.step) control.step = f.step;
        if (control.type !== "checkbox") control.required = true;
      } else this.selects.set(f.id, control);
      control.value = f.value ?? "";
      wrapper.append(control);
      form.append(wrapper);
      if (f.options) this.options(f.id, f.options);
    }
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = label;
    form.append(submit);
    form.onsubmit = (e) => {
      e.preventDefault();
      const values: Record<string, string> = {};
      for (const f of fields) {
        const node = form.elements.namedItem(f.id) as
          HTMLInputElement | HTMLSelectElement;
        values[f.id] =
          node instanceof HTMLInputElement && node.type === "checkbox"
            ? String(node.checked)
            : node.value;
      }
      fn(values);
    };
    box.append(form);
  }
  private options(id: string, options: [string, string][]) {
    const select = this.selects.get(id);
    if (!select) return;
    const signature = JSON.stringify(options);
    if (select.dataset.signature === signature) return;
    const current = select.value;
    select.replaceChildren(
      ...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
    if (options.some(([v]) => v === current)) select.value = current;
    select.dataset.signature = signature;
  }
  private keys(keys: string[]): [string, string][] {
    return keys.map((k) => [k, labels[k] ?? k]);
  }
  private warehouses() {
    let b = this.box(
      "warehouses",
      "Fyzické sklady",
      "Zóny mají vlastní hmotnostní a objemovou kapacitu. Příjem i přeprava rezervují místo; VZV potřebuje širší uličku. Ruční přepravka unese 30 kg.",
    );
    this.form(
      b,
      "Postavit skladovou zónu",
      [
        { id: "zone-name", label: "Název skladu", value: "Sklad surovin" },
        {
          id: "zone-x",
          label: "X skladu",
          type: "number",
          value: "70",
          min: 1,
          max: 98,
        },
        {
          id: "zone-y",
          label: "Y skladu",
          type: "number",
          value: "50",
          min: 1,
          max: 68,
        },
        {
          id: "zone-w",
          label: "Šířka skladu",
          type: "number",
          value: "8",
          min: 1,
          max: 98,
        },
        {
          id: "zone-h",
          label: "Výška skladu",
          type: "number",
          value: "8",
          min: 1,
          max: 68,
        },
        {
          id: "zone-kg",
          label: "Kapacita kg",
          type: "number",
          value: "10000",
          min: 1,
        },
        {
          id: "zone-m3",
          label: "Kapacita m³",
          type: "number",
          value: "50",
          min: 1,
        },
        {
          id: "zone-kind",
          label: "Typ skladu",
          type: "select",
          options: this.keys(["mixed", "raw", "wip", "finished", "quarantine"]),
        },
      ],
      (v) =>
        this.run({
          type: "zone",
          name: v["zone-name"]!,
          x: +v["zone-x"]!,
          y: +v["zone-y"]!,
          width: +v["zone-w"]!,
          height: +v["zone-h"]!,
          maxKg: +v["zone-kg"]!,
          maxM3: +v["zone-m3"]!,
          kind: v["zone-kind"] as "mixed",
        }),
    );
    this.out(b, "zones-report");
    b = this.box("warehouses", "Přeprava a kontejnery");
    this.form(
      b,
      "Přesunout část šarže",
      [
        { id: "move-lot", label: "Přepravovaná šarže", type: "select" },
        {
          id: "move-quantity",
          label: "Přepravované množství",
          type: "number",
          value: "1",
          min: 0.001,
          step: "0.001",
        },
        { id: "move-target", label: "Cílový sklad", type: "select" },
      ],
      (v) =>
        this.run({
          type: "move",
          lotId: v["move-lot"]!,
          quantity: +v["move-quantity"]!,
          to: v["move-target"]!,
        }),
    );
    this.form(
      b,
      "Koupit vozidlo",
      [
        {
          id: "vehicle-kind",
          label: "Vozidlo",
          type: "select",
          options: this.keys(["forklift", "agv"]),
        },
      ],
      (v) =>
        this.run({ type: "vehicle", kind: v["vehicle-kind"] as "forklift" }),
    );
    this.out(b, "traffic-report");
    b = this.box(
      "warehouses",
      "Rampy a dodací okna",
      "Nové dodávky mají rezervovaný patnáctiminutový slot. Dodávka mimo okno čeká na otevření.",
    );
    this.form(
      b,
      "Postavit rampu",
      [
        {
          id: "dock-x",
          label: "X rampy",
          type: "number",
          value: "2",
          min: 0,
          max: 99,
        },
        {
          id: "dock-y",
          label: "Y rampy",
          type: "number",
          value: "4",
          min: 0,
          max: 69,
        },
        {
          id: "dock-open",
          label: "Otevřeno od hodiny",
          type: "number",
          value: "6",
          min: 0,
          max: 23,
        },
        {
          id: "dock-close",
          label: "Otevřeno do hodiny",
          type: "number",
          value: "22",
          min: 1,
          max: 24,
        },
      ],
      (v) =>
        this.run({
          type: "dock",
          x: +v["dock-x"]!,
          y: +v["dock-y"]!,
          openHour: +v["dock-open"]!,
          closeHour: +v["dock-close"]!,
        }),
    );
    this.form(
      b,
      "Změnit místo příjmu",
      [
        { id: "receipt-delivery", label: "Příchozí dodávka", type: "select" },
        { id: "receipt-zone", label: "Příjmový sklad", type: "select" },
      ],
      (v) =>
        this.run({
          type: "delivery-zone",
          deliveryId: v["receipt-delivery"]!,
          zoneId: v["receipt-zone"]!,
        }),
    );
    this.out(b, "docks-report");
  }
  private planning() {
    let b = this.box("planning", "Trh a rámcové smlouvy");
    this.form(b, "Načíst nové poptávky", [], () =>
      this.run({ type: "market" }),
    );
    this.form(
      b,
      "Uzavřít rámcovou smlouvu",
      [
        {
          id: "framework-product",
          label: "Výrobek rámcové smlouvy",
          type: "select",
          options: PRODUCTS.map((p) => [p.id, p.name]),
        },
        {
          id: "framework-quantity",
          label: "Měsíční odvolávka ks",
          type: "number",
          value: "50",
          min: 1,
          max: 1000,
        },
        {
          id: "framework-months",
          label: "Doba smlouvy měsíců",
          type: "number",
          value: "36",
          min: 1,
          max: 36,
        },
      ],
      (v) =>
        this.run({
          type: "framework",
          productId: v["framework-product"]!,
          quantity: +v["framework-quantity"]!,
          months: +v["framework-months"]!,
        }),
    );
    this.out(b, "framework-report");
    this.form(
      b,
      "Předložit cenovou nabídku",
      [
        { id: "quote-contract", label: "Poptávka k nabídce", type: "select" },
        {
          id: "quote-price",
          label: "Nabídková cena Kč za kus",
          type: "number",
          value: "1850",
          min: 1,
        },
      ],
      (v) =>
        this.run({
          type: "quote",
          contractId: v["quote-contract"]!,
          priceMinor: Math.round(+v["quote-price"]! * 100),
        }),
    );
    b = this.box(
      "planning",
      "Výrobní příkazy a MRP",
      "Plán rezervuje dostupné zásoby. Uvolnění nakoupí chybějící materiál a předá rezervace výrobě. Výrobek se nevytváří přijetím objednávky.",
    );
    this.form(
      b,
      "Připravit výrobní příkaz",
      [
        { id: "plan-contract", label: "Přijatá zakázka", type: "select" },
        {
          id: "plan-make",
          label: "Vyrábět komponenty ze surovin",
          type: "checkbox",
        },
      ],
      (v) =>
        this.run({
          type: "plan",
          contractId: v["plan-contract"]!,
          makeComponents: v["plan-make"] === "true",
        }),
    );
    this.form(
      b,
      "Uvolnit výrobní příkaz",
      [{ id: "release-plan", label: "Připravený plán", type: "select" }],
      (v) => this.run({ type: "release-plan", planId: v["release-plan"]! }),
    );
    this.out(b, "mrp-report");
    b = this.box("planning", "Kapacita, termíny a cash flow");
    this.out(b, "capacity-report");
    this.out(b, "finance-report");
    this.out(b, "calendar-report");
  }
  private workforce() {
    let b = this.box(
      "workforce",
      "Směny, kvalifikace a absence",
      "Cyklus nezačne, pokud nezbývá dost času do konce směny. Školení trvá jeden den a stojí 10 000 Kč; CAB vyžaduje kvalifikaci.",
    );
    this.form(
      b,
      "Změnit směnu",
      [
        { id: "shift-worker", label: "Pracovník směny", type: "select" },
        {
          id: "shift-kind",
          label: "Směna",
          type: "select",
          options: this.keys(["continuous", "morning", "afternoon", "night"]),
        },
      ],
      (v) =>
        this.run({
          type: "shift",
          workerId: v["shift-worker"]!,
          shift: v["shift-kind"] as "morning",
        }),
    );
    this.form(
      b,
      "Zahájit školení",
      [
        { id: "train-worker", label: "Školený pracovník", type: "select" },
        {
          id: "train-skill",
          label: "Kvalifikace",
          type: "select",
          options: this.keys([
            "operation",
            "assembly",
            "quality",
            "CAB",
            "forklift",
            "maintenance",
          ]),
        },
      ],
      (v) =>
        this.run({
          type: "train",
          workerId: v["train-worker"]!,
          skill: v["train-skill"]!,
        }),
    );
    this.form(
      b,
      "Naplánovat absenci",
      [
        { id: "absence-worker", label: "Nepřítomný pracovník", type: "select" },
        {
          id: "absence-days",
          label: "Dny nepřítomnosti",
          type: "number",
          value: "1",
          min: 1,
          max: 30,
        },
      ],
      (v) =>
        this.run({
          type: "absence",
          workerId: v["absence-worker"]!,
          days: +v["absence-days"]!,
        }),
    );
    this.out(b, "workers-report");
    this.form(
      b,
      "Přiřadit specialistu",
      [
        {
          id: "assign-specialist-machine",
          label: "Pracoviště specialisty",
          type: "select",
        },
        {
          id: "assign-specialist-worker",
          label: "Vybraný specialista",
          type: "select",
        },
      ],
      (v) =>
        this.run({
          type: "assign",
          machineId: v["assign-specialist-machine"]!,
          workerId: v["assign-specialist-worker"]!,
        }),
    );
    this.form(
      b,
      "Přiřadit směnový tým",
      [
        { id: "roster-machine", label: "Pracoviště týmu", type: "select" },
        { id: "roster-first", label: "První operátor", type: "select" },
        { id: "roster-second", label: "Druhý operátor", type: "select" },
      ],
      (v) =>
        this.run({
          type: "roster",
          machineId: v["roster-machine"]!,
          workerIds: [v["roster-first"]!, v["roster-second"]!],
        }),
    );
    this.form(
      b,
      "Najmout specialistu",
      [
        {
          id: "hire-specialist",
          label: "Profese specialisty",
          type: "select",
          options: Object.entries(ROLES).map(([id, r]) => [
            id,
            `${r.name} · ${money(r.wageMinor)}/den`,
          ]),
        },
      ],
      (v) =>
        this.run({ type: "hire", role: v["hire-specialist"] as EmployeeRole }),
    );
    b = this.box("workforce", "Plán údržby a servisní zásoby");
    this.form(
      b,
      "Nastavit servisní interval",
      [
        {
          id: "service-machine",
          label: "Stroj pro plán údržby",
          type: "select",
        },
        {
          id: "service-interval",
          label: "Interval cyklů",
          type: "number",
          value: "100",
          min: 10,
        },
      ],
      (v) =>
        this.run({
          type: "service",
          machineId: v["service-machine"]!,
          intervalCycles: +v["service-interval"]!,
        }),
    );
    this.form(
      b,
      "Provést preventivní servis",
      [
        {
          id: "preventive-machine",
          label: "Stroj pro preventivní servis",
          type: "select",
        },
      ],
      (v) =>
        this.run({ type: "preventive", machineId: v["preventive-machine"]! }),
    );
    this.form(
      b,
      "Nastavit automatické plánování servisu",
      [{ id: "service-auto", label: "Automatický servis", type: "checkbox" }],
      (v) =>
        this.run({
          type: "policy",
          key: "autoService",
          enabled: v["service-auto"] === "true",
        }),
    );
    this.out(b, "service-report");
  }
  private utilities() {
    let b = this.box(
      "utilities",
      "Rozvody a vlastní technologie",
      "Zdroje mají omezenou souběžnou kapacitu. CAB potřebuje elektřinu, dusík, chlazení a odsávání, zásobu dusíku a kvalifikovanou obsluhu. V katalogu lze umístit tavidlo i CAB.",
    );
    this.form(
      b,
      "Pořídit zdroj / rozvodnu",
      [
        {
          id: "source-kind",
          label: "Médium zdroje",
          type: "select",
          options: this.keys(["power", "air", "water", "nitrogen", "exhaust"]),
        },
        {
          id: "source-capacity",
          label: "Souběžná kapacita",
          type: "number",
          value: "100",
          min: 1,
          max: 10000,
        },
        {
          id: "source-x",
          label: "X zdroje",
          type: "number",
          value: "2",
          min: 0,
          max: 99,
        },
        {
          id: "source-y",
          label: "Y zdroje",
          type: "number",
          value: "2",
          min: 0,
          max: 69,
        },
      ],
      (v) =>
        this.run({
          type: "utility-source",
          kind: v["source-kind"] as "power",
          capacity: +v["source-capacity"]!,
          x: +v["source-x"]!,
          y: +v["source-y"]!,
        }),
    );
    this.form(
      b,
      "Položit rozvod ke stroji",
      [
        { id: "link-machine", label: "Připojovaný stroj", type: "select" },
        { id: "link-source", label: "Zdroj rozvodu", type: "select" },
      ],
      (v) =>
        this.run({
          type: "utility-link",
          machineId: v["link-machine"]!,
          sourceId: v["link-source"]!,
        }),
    );
    this.form(
      b,
      "Nastavit provoz zdroje",
      [
        { id: "toggle-source", label: "Řízený zdroj", type: "select" },
        { id: "source-enabled", label: "Zdroj zapnutý", type: "checkbox" },
      ],
      (v) =>
        this.run({
          type: "utility-toggle",
          sourceId: v["toggle-source"]!,
          enabled: v["source-enabled"] === "true",
        }),
    );
    this.form(
      b,
      "Nastavit výrobní trasu",
      [
        {
          id: "local-brazing",
          label: "Vlastní tavidlo a CAB pro MRP",
          type: "checkbox",
        },
        {
          id: "detail-utilities",
          label: "Vynucovat detailní rozvody i u dokončovacích stanic",
          type: "checkbox",
        },
      ],
      (v) => {
        this.run({
          type: "policy",
          key: "localBrazing",
          enabled: v["local-brazing"] === "true",
        });
        this.run({
          type: "policy",
          key: "detailedUtilities",
          enabled: v["detail-utilities"] === "true",
        });
      },
    );
    this.out(b, "utilities-report");
    b = this.box(
      "utilities",
      "Odpady a sledovatelnost",
      "Kovový odpad lze prodat, karanténa má placenou likvidaci. Likvidace rezervované zásoby není možná.",
    );
    this.form(
      b,
      "Zpracovat odpad",
      [
        { id: "waste-lot", label: "Odpadní šarže", type: "select" },
        {
          id: "waste-quantity",
          label: "Likvidované množství",
          type: "number",
          value: "1",
          min: 0.001,
          step: ".001",
        },
      ],
      (v) =>
        this.run({
          type: "waste",
          lotId: v["waste-lot"]!,
          quantity: +v["waste-quantity"]!,
        }),
    );
    this.out(b, "trace-report");
  }
  private automation() {
    let b = this.box("automation", "Výzkum a robotizace");
    this.form(
      b,
      "Zahájit výzkum",
      [
        {
          id: "research-id",
          label: "Výzkumný projekt",
          type: "select",
          options: RESEARCH.map((r) => [
            r.id,
            `${r.name} · ${money(r.costMinor)} · ${r.seconds / 86400} dny`,
          ]),
        },
      ],
      (v) => this.run({ type: "research", researchId: v["research-id"]! }),
    );
    this.form(
      b,
      "Robotizovat pracoviště",
      [
        {
          id: "robot-machine",
          label: "Robotizované pracoviště",
          type: "select",
        },
      ],
      (v) => this.run({ type: "robot", machineId: v["robot-machine"]! }),
    );
    this.out(b, "research-report");
    b = this.box("automation", "Dopravníkové trasy");
    this.form(
      b,
      "Postavit dopravník",
      [
        { id: "conveyor-from", label: "Začátek dopravníku", type: "select" },
        { id: "conveyor-to", label: "Konec dopravníku", type: "select" },
      ],
      (v) =>
        this.run({
          type: "conveyor",
          from: v["conveyor-from"]!,
          to: v["conveyor-to"]!,
        }),
    );
    this.out(b, "conveyor-report");
    b = this.box(
      "automation",
      "MES · automatické doplňování a výrobní analytika",
    );
    this.form(
      b,
      "Nastavit doplňování",
      [
        {
          id: "kanban-item",
          label: "Doplňovaný materiál",
          type: "select",
          options: items
            .filter(
              (i) =>
                i.kind === "raw" ||
                i.kind === "component" ||
                i.kind === "medium",
            )
            .map((i) => [i.id, i.name]),
        },
        {
          id: "kanban-min",
          label: "Minimum zásoby",
          type: "number",
          value: "10",
          min: 0,
          step: ".001",
        },
        {
          id: "kanban-target",
          label: "Cílová zásoba",
          type: "number",
          value: "100",
          min: 0.001,
          max: 10000,
          step: ".001",
        },
        { id: "kanban-enabled", label: "Doplňování zapnuté", type: "checkbox" },
      ],
      (v) =>
        this.run({
          type: "replenish",
          itemId: v["kanban-item"]!,
          minimum: +v["kanban-min"]!,
          target: +v["kanban-target"]!,
          enabled: v["kanban-enabled"] === "true",
        }),
    );
    this.out(b, "mes-report");
  }
  refresh() {
    if (!this.dialog.open && this.selects.size > 0) return;
    const s = this.sim.state,
      e = s.enterprise,
      now = s.tick * GAME_SECONDS_PER_TICK;
    const workers = s.employees.map(
        (w) =>
          [
            w.id,
            `${w.id} · ${ROLES[w.role as EmployeeRole]?.name ?? w.role}`,
          ] as [string, string],
      ),
      machines = s.machines.map(
        (m) => [m.id, `${m.id} · ${m.definitionId}`] as [string, string],
      ),
      zones: [string, string][] = [
        ["warehouse", "Centrální sklad"],
        ...e.zones.map((z) => [z.id, z.name] as [string, string]),
      ];
    for (const id of [
      "shift-worker",
      "train-worker",
      "absence-worker",
      "roster-first",
      "roster-second",
      "assign-specialist-worker",
    ])
      this.options(id, workers);
    for (const id of [
      "service-machine",
      "preventive-machine",
      "link-machine",
      "robot-machine",
      "roster-machine",
      "assign-specialist-machine",
    ])
      this.options(id, machines);
    this.options(
      "move-lot",
      s.lots
        .filter((l) => l.quantity > l.reserved)
        .slice(0, 200)
        .map((l) => [
          l.id,
          `${l.id} · ${l.itemId} × ${fmt(l.quantity - l.reserved)} · ${l.locationId}`,
        ]),
    );
    this.options("move-target", zones);
    this.options(
      "receipt-zone",
      zones.filter(([id]) => id !== "warehouse"),
    );
    this.options(
      "receipt-delivery",
      s.factory.deliveries.map((d) => [d.id, `${d.itemId} × ${d.quantity}`]),
    );
    this.options(
      "quote-contract",
      s.factory.contracts
        .filter((c) => c.status === "offer" && !e.quotes[c.id])
        .map((c) => [c.id, `${c.id} · ${money(c.unitPriceMinor)}/ks`]),
    );
    this.options(
      "plan-contract",
      s.factory.contracts
        .filter((c) => c.status === "accepted")
        .map((c) => [c.id, `${c.id} · ${c.quantity} ks`]),
    );
    this.options(
      "release-plan",
      e.plans
        .filter((p) => p.status === "planned")
        .map((p) => [p.id, `${p.id} · ${p.contractId}`]),
    );
    const sources = e.utilities.map(
      (u) =>
        [u.id, `${u.id} · ${labels[u.kind]} · ${u.capacity}`] as [
          string,
          string,
        ],
    );
    this.options("link-source", sources);
    this.options("toggle-source", sources);
    this.options(
      "waste-lot",
      s.lots
        .filter((l) => l.quality === "scrap" || l.quality === "quarantine")
        .slice(0, 200)
        .map((l) => [l.id, `${l.itemId} · ${fmt(l.quantity)} · ${l.quality}`]),
    );
    this.options(
      "conveyor-from",
      machines.map(([id, label]) => [`${id}:out`, label + " výstup"]),
    );
    this.options("conveyor-to", [
      ...zones,
      ...machines.map(
        ([id, label]) => [`${id}:in`, label + " vstup"] as [string, string],
      ),
    ]);
    const text = (id: string, value: string) => {
      if (this.el(id).textContent !== value) this.el(id).textContent = value;
    };
    text(
      "zones-report",
      e.zones
        .map((z) => {
          const u = usage(s, z.id);
          return `${z.name} [${z.x},${z.y}] · ${fmt(u.kg)}/${fmt(z.maxKg)} kg · ${fmt(u.m3)}/${fmt(z.maxM3)} m³`;
        })
        .join("\n") ||
        "Centrální příjem je dostupný od začátku. Vytvořte další fyzický sklad.",
    );
    text(
      "traffic-report",
      `${e.containers.length} kontejnerů · ${s.factory.transfers.length} přeprav\n` +
        e.vehicles
          .map((v) => `${v.id}: ${labels[v.kind]} · ${v.capacityKg} kg`)
          .join("\n") +
        "\n" +
        e.transport
          .slice(0, 20)
          .map(
            (t) =>
              `${t.taskId} · ${labels[t.mode]} · start ${fmt(t.notBefore / 3600)} h`,
          )
          .join("\n"),
    );
    text(
      "docks-report",
      e.docks
        .map(
          (d) =>
            `${d.id}: ${d.openHour}–${d.closeHour} h · rezervováno do ${fmt(d.busyUntil / 86400)} dne`,
        )
        .join("\n") || "Bez rampy přijímá centrální sklad nepřetržitě.",
    );
    text(
      "framework-report",
      Object.entries(e.quotes)
        .map(
          ([id, q]) =>
            `${id}: nabídka ${money(q.priceMinor)} · ${q.accepted ? "přijatá" : "odmítnutá"}`,
        )
        .join("\n") +
        "\n" +
        e.frameworks
          .map(
            (f) =>
              `${f.id}: ${f.quantity} ks/měsíc · další odvolávka den ${fmt(f.next / 86400)} · ${f.active ? "aktivní" : "ukončeno"}`,
          )
          .join("\n"),
    );
    const contract = s.factory.contracts.find(
      (c) => c.id === this.selects.get("plan-contract")?.value,
    );
    text(
      "mrp-report",
      contract
        ? mrp(
            s,
            contract.quantity,
            e.contractProducts[contract.id] ?? "FE-HX001",
          )
            .map(
              (r) =>
                `${r.itemId}: potřeba ${fmt(r.required)}, dostupné ${fmt(r.available)}, na cestě ${fmt(r.incoming)}, chybí ${fmt(r.shortage)}`,
            )
            .join("\n")
        : "Nejdříve přijměte zakázku v hlavním panelu.",
    );
    const cap = capacity(s);
    text(
      "capacity-report",
      cap.rows
        .map((r) => `${r.recipeId}: ${fmt(r.nominalPerHour)} ks/h`)
        .join("\n") +
        `\nÚzké místo: ${cap.bottleneck.recipeId} · ${fmt(cap.perHour)} ks/h · kooperace ${cap.cooperationDays} dny`,
    );
    const finances = financialReport(s);
    text(
      "finance-report",
      `Hotovost ${money(finances.cashMinor)} · zásoby a WIP ${money(finances.inventoryMinor)} · pohledávky ${money(finances.receivablesMinor)} · závazky ${money(finances.payablesMinor)} · zisk ${money(finances.profitMinor)}`,
    );
    text(
      "calendar-report",
      s.factory.contracts
        .filter((c) => c.status === "accepted" || c.status === "shipped")
        .map(
          (c) =>
            `${c.id}: ${c.status}, termín den ${fmt(c.deadline / 86400)} · penalizace ${e.penalties[c.id] ?? 0} dní`,
        )
        .join("\n") +
        "\n" +
        e.reports
          .slice(-10)
          .map(
            (r) =>
              `Den ${r.day}: cash ${money(r.cashMinor)}, expedice ${r.shipped} ks`,
          )
          .join("\n"),
    );
    text(
      "workers-report",
      s.employees
        .map((w) => {
          const p = e.workerProfiles[w.id];
          return `${w.id} · ${ROLES[w.role as EmployeeRole]?.name ?? w.role} · ${labels[p?.shift ?? "continuous"]} · ${onShift(s, w, now) ? "dostupný" : "mimo provoz"} · ${p?.skills.join(", ") ?? "základní kvalifikace"}${p?.trainingSkill ? " · školení " + p.trainingSkill : ""}`;
        })
        .join("\n"),
    );
    text(
      "service-report",
      Object.entries(e.service)
        .map(
          ([id, v]) =>
            `${id}: servis po ${v.intervalCycles} cyklech · poruchy ${v.failures} · MTTR ${v.failures ? fmt(v.repairSeconds / v.failures / 3600) : "—"} h · ${v.faultReason}`,
        )
        .join("\n"),
    );
    text(
      "utilities-report",
      e.utilities
        .map(
          (u) =>
            `${u.id}: ${labels[u.kind]} ${u.capacity} · ${u.enabled ? "zapnuto" : "vypnuto"}`,
        )
        .join("\n") +
        "\n" +
        e.links
          .map((l) => `${l.machineId} ← ${l.sourceId} · ${l.path.length} m`)
          .join("\n"),
    );
    text(
      "trace-report",
      e.inspections
        .slice(-10)
        .map(
          (i) =>
            `${i.batchId} · ${i.passed ? "vyhovuje" : "karanténa"} · ${i.machineId}`,
        )
        .join("\n") +
        "\n" +
        e.genealogy
          .slice(-15)
          .map(
            (b) =>
              `${b.id}: ${b.itemId} × ${b.quantity} ← ${b.parents.join(", ") || "příjem"} · ${b.recipeId}`,
          )
          .join("\n"),
    );
    text(
      "research-report",
      e.research
        .map(
          (r) =>
            `${RESEARCH.find((x) => x.id === r.id)?.name}: ${r.status === "done" ? "dokončeno" : "běží do dne " + fmt(r.due / 86400)}`,
        )
        .join("\n") +
        "\nRobotizace: " +
        e.automatic.join(", "),
    );
    text(
      "conveyor-report",
      e.conveyors
        .map((c) => `${c.id}: ${c.from} → ${c.to} · ${c.path.length} m`)
        .join("\n"),
    );
    text(
      "mes-report",
      s.factory.machines
        .slice(0, 50)
        .map((m) => {
          const report = oee(s, m.id, now);
          return `${m.id}: A ${fmt(report.availability * 100)} % · P ${fmt(report.performance * 100)} % · Q ${fmt(report.quality * 100)} % · OEE ${fmt(report.oee * 100)} % · ${m.reason}`;
        })
        .join("\n") +
        "\n" +
        e.replenish
          .map(
            (r) =>
              `${r.itemId}: min ${r.minimum} → ${r.target}, ${r.enabled ? "automaticky" : "vypnuto"}`,
          )
          .join("\n"),
    );
  }
}
