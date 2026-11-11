import { machines } from "../data/catalog";
import type { GameState } from "../core/model";
import { GAME_SECONDS_PER_TICK } from "../core/time";
export interface FirstOrderHint {
  title: string;
  body: string;
}
export function firstOrderHint(s: GameState): FirstOrderHint {
  if (!s.world.owned)
    return {
      title: "1. Kupte pozemek",
      body: "Začínáte s 300 mil. Kč. Tlačítkem Koupit pozemek pořídíte parcelu za 50 mil. Kč.",
    };
  if (!s.factory.hall)
    return {
      title: "2. Postavte halu",
      body: "Výchozí rozměry haly jsou vyplněné. Před nákupem dalšího vybavení ponechte rezervu na materiál a mzdy.",
    };
  const contract = s.factory.contracts.find((c) => c.id === "HX-001");
  if (contract?.status === "paid")
    return {
      title: "První zakázka je zaplacená",
      body: "Zkontrolujte finanční přehled v Řízení závodu. Zisk zahrnuje materiál, energie a běžící mzdy; malá první zakázka nemusí pokrýt provoz během splatnosti.",
    };
  if (contract?.status === "shipped") {
    const invoice = s.factory.invoices.find(
      (i) => i.contractId === contract.id && !i.paid,
    );
    const remaining = invoice
      ? Math.max(
          0,
          Math.ceil((invoice.due - s.tick * GAME_SECONDS_PER_TICK) / 86400),
        )
      : 0;
    return {
      title: "Čekáte na inkaso",
      body: `Výrobky jsou expedované a výnos zaúčtovaný. Hotovost přijde za ${remaining} herních dní. Mzdy mezitím pokračují; můžete plnit další zakázky.`,
    };
  }
  const required = ["M006", "M007", "M011", "M010", "M012"];
  const missing = required.filter(
    (id) => !s.machines.some((m) => m.definitionId === id),
  );
  if (missing.length)
    return {
      title: "3. Připravte výrobní pracoviště",
      body: `V katalogu umístěte chybějící stroje: ${missing.map((id) => `${machines.find((m) => m.id === id)?.name ?? id} (${id})`).join(", ")}. První průchod používá nakoupené komponenty a externí tavidlo/CAB. Mezi stroji nechte uličky.`,
    };
  const broken = s.machines.find((m) => m.status === "fault");
  if (broken)
    return {
      title: "Odstraňte poruchu",
      body: `Stroj ${broken.definitionId} potřebuje opravu. Najměte údržbáře, objednejte sadu náhradních dílů a po dodání spusťte opravu v kontextu stroje.`,
    };
  const incomplete = s.factory.machines.find(
    (m) =>
      required.includes(s.machines.find((p) => p.id === m.id)!.definitionId) &&
      (!m.power || !m.air || !m.workerId || !m.enabled),
  );
  if (incomplete)
    return {
      title: "4. Zapojte stroje a přiřaďte obsluhu",
      body: "Najměte pět operátorů a skladníka. Zrušte umisťování, klikněte na každý stroj, připojte elektřinu a vzduch, přiřaďte operátora a spusťte recepturu.",
    };
  if (!s.employees.some((w) => w.role === "warehouse"))
    return {
      title: "Najměte skladníka",
      body: "Bez skladníka nemá kdo dopravovat vstupy a odvážet výstupy. Tlačítko najdete v pravém panelu Provoz.",
    };
  if (contract?.status === "offer")
    return {
      title: "5. Přijměte zakázku a připravte nákup",
      body: "Vpravo přijměte HX-001 (10 ks). Potom Řízení závodu → Plánování a obchod → Připravit výrobní příkaz → Uvolnit výrobní příkaz. Volbu výroby komponent ze surovin ponechte vypnutou.",
    };
  const plan = s.enterprise.plans.find((p) => p.contractId === "HX-001");
  if (contract?.status === "accepted" && (!plan || plan.status === "planned"))
    return {
      title: "6. Uvolněte materiálový plán",
      body: "V Řízení závodu → Plánování a obchod připravte a uvolněte příkaz pro HX-001. MRP objedná chybějící komponenty a média jednou. Neobsahuje rezervu na neshody: podle potřeby objednejte náhradní vstupy.",
    };
  const good = s.lots
    .filter(
      (l) =>
        l.itemId === "FE-HX001" &&
        l.quality === "good" &&
        (l.locationId === "warehouse" || l.locationId.startsWith("zone-")),
    )
    .reduce((n, l) => n + l.quantity - l.reserved, 0);
  if (good >= (contract?.quantity ?? 10))
    return {
      title: "7. Expedujte první zakázku",
      body: "Dobré zabalené kusy jsou ve skladu. V pravém panelu klikněte Expedovat HX-001. Vznikne faktura, pohledávka a splatnost 30 dní; hotovost se nepřičte okamžitě.",
    };
  const cores = s.lots
    .filter(
      (l) =>
        l.itemId === "W001" &&
        l.quality === "good" &&
        (l.locationId === "warehouse" || l.locationId.startsWith("zone-")),
    )
    .reduce((n, l) => n + l.quantity - l.reserved, 0);
  if (cores > 0 && !s.enterprise.policies.localBrazing)
    return {
      title: "Pošlete jádra do kooperace",
      body: `Ve skladu je ${cores} sestavených jader. Vpravo v Kooperace zadejte počet a odešlete je. Tavidlo a CAB trvají dva herní dny; po návratu pokračuje test, povrch a balení.`,
    };
  return {
    title: "Probíhá výroba a doprava",
    body: `Dobré zabalené kusy ve skladu: ${good}/${contract?.quantity ?? 10}. Zapněte čas. Dodávky trvají nejméně čtyři herní hodiny; příčinu čekání zjistíte kliknutím na stroj. Nevyhovující kus patří do karantény, nikoli do expedice.`,
  };
}
