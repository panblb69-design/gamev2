# Ověření verze 0.6.0

Lokální běh 2026-11-10, znovu ověřeno po obnovení pracovního prostředí.

| Kontrola                                                           | Výsledek                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| npm run typecheck                                                  | prošlo                                               |
| npm run lint                                                       | prošlo                                               |
| npm test                                                           | 67/67 testů, 5 souborů, žádné přeskočené testy       |
| npm run build                                                      | prošlo, samostatný worker a validační chunk          |
| TEST_PREVIEW=1 CHROMIUM_PATH=/usr/bin/chromium npx playwright test | 5/5, žádné přeskočené testy, skutečný produkční dist |
| git diff --check                                                   | prošlo                                               |

Browser: mapa/čas/IndexedDB, stavba a obsluha, přehledy všech milníků, odezva mapy při zátěži workeru a export/import potvrzeného snapshotu. Zátěžový browser test dokládá odezvu, nikoli garanci 60 FPS.

Společná headless kampaň projde od rámcové odvolávky a MRP přes výrobu komponent ze surovin, přestavbu lisu, vlastní tavidlo/CAB, výzkum a exportní balení až k expedici a inkasu po save/load. Neshody, poruchy, směny, kapacity, přetížení a zpožděné platby mají samostatné scénáře.

## Headless benchmark aktuálního běhu

144 stanic, 200 lidí, 5000 počátečních šarží; 200 ticků = 7200 herních sekund.

- Zpracování: 3248.7 ms celkem.
- p95 tick: 151.7 ms; nejdelší tick: 189.0 ms.
- Dokončené výrobní cykly: 2871.
- Přepravní úlohy na konci: 2836 (záměrně zatížená sdílená logistika; blokování a backpressure brání neomezenému vytváření úloh).

Jde o CPU čas na tomto cloud stroji, nikoli přenositelnou hardwarovou garanci. Vyšší špičky jsou důvodem provozu simulace ve Web Workeru. Benchmark má předem připravené vstupy a vyšší scénářový rozpočet/příkon; nová hra stále začíná se 300 mil. Kč. Plný JSON aktuálního běhu je lokálně v artifacts/performance.json.

Build hlásí neblokující upozornění na komentářové anotace uvnitř Zod; TypeScript, sestavení i runtime testy prošly. Nedošlo ke změně ověřování balíčků ani vypnutí TLS.

## Doručení

Verze nebyla pushnuta ani nasazena. Předchozí obsah GitHub Pages touto iterací nebyl změněn.
