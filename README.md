# Factory Empire — M0–M6

Česká průmyslová hra podle zadání v0.1. Implementované milníky M0–M6 tvoří první funkční verzi. Přesná akceptace a herní zjednodušení jsou v [MILESTONE_ACCEPTANCE.md](docs/MILESTONE_ACCEPTANCE.md). Bez backendu a vzdálených runtime API.

## Spuštění

Node.js 22+ (ověřeno 24.22.1), npm 11. V existujícím checkoutu:

```sh
npm ci
npm run dev
```

V prohlížeči otevřete adresu vypsanou Vite. Mapu zobrazuje PixiJS s WebGL; prohlížeč musí WebGL podporovat. V cloud sandboxu s nezapisovatelným domovským adresářem přidejte k npm příkazům `--cache /tmp/factory-npm`.

## Co skutečně funguje

- WebGL mapa s výstavbou, kolizemi, kamerou a agregovanou manipulací; simulace běží v samostatném Web Workeru.
- Celý FE-HX001 od suroviny nebo nakoupených komponent přes vlastní výrobu/kooperaci až po kvalitu, balení, expedici a inkaso.
- Fyzické sklady, kontejnery, FIFO a rezervace, VZV, rampy a příjmové sloty.
- MRP, výrobní příkazy, cenové nabídky, rámcové smlouvy, odvolávky, sankce a přehled kapacity/financí.
- Profese, směny, týmy, kvalifikace, školení, absence, poruchy a servis.
- Vlastní tavidlo a CAB, kapacitní rozvody a spotřeba médií, odpad a sledovatelnost.
- Výzkum, robotizace, AGV, dopravníky, MES doplňování a OEE. FE-HX001-P je exportní balicí varianta, nikoli nově homologovaný tepelný výměník.
- Kapitál 300 mil. Kč, české UI, fixed-step a seed. IndexedDB/JSON save v3 a migrace M0/M1.

Všechny ceny, spotřeby a technické koeficienty jsou **neověřené herní hodnoty**. Hranice modelu a přesnou evidenci testů najdete v dokumentaci. Ovládání nových systémů otevřete tlačítkem **Řízení závodu** v horním panelu.

## Kontroly

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
```

V cloudu lze použít systémový prohlížeč: `CHROMIUM_PATH=/usr/bin/chromium npx playwright test`. Jinak se použije instalovaný Playwright Chromium. Testy pokrývají hodiny, BOM, frontu skutečných výrobních a ekonomických událostí, scénáře T01–T10 v rozsahu M1, poruchu/opravu, migraci a save/load během výroby. Browser testy ověřují mapu a základní ovládání M0 i stavbu, přípojky, operátora a obnovení závodu M1. Výrobní průchod celé zakázky je headless integrační test stejného jádra, nikoli kompletní browser click-through.

Pro test produkčního buildu včetně worker assetu: `TEST_PREVIEW=1 CHROMIUM_PATH=/usr/bin/chromium npx playwright test` (nejprve `npm run build`, port 5173 musí být volný). `npm test` vytváří lokální `artifacts/performance.json`; benchmark izoluje 144 stanic, 200 lidí a 5000 šarží. Současně běží test celé kampaně M2–M6 od surovin až k uhrazené faktuře po načtení save.

## GitHub Pages

Workflow `.github/workflows/pages.yml` ověřuje lint, testy a build a nasazuje `dist/` oficiálním Pages artifact deploymentem. Běží po push do `main` či `feat/factory-empire-m0`; lze ho spustit i ručně.

**Tato iterace se podle uživatelského pokynu nenahrává.** Následující postup je připravený pro pozdější schválené nasazení. Samotné lokální build/test nic nepublikují.

První zapnutí v GitHubu:

1. Otevřete repozitář → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. V **Settings → Environments → github-pages** případně povolte nasazování z větve `feat/factory-empire-m0` (ochrana může ve výchozím stavu povolovat jen hlavní větev).
3. Otevřete **Actions → Deploy Factory Empire to Pages** a zopakujte poslední běh. Pro ruční Run workflow musí být workflow i ve výchozí větvi; před sloučením použijte Re-run jobs u běhu vytvořeného pushem.
4. Po zeleném kroku deploy otevřete URL z jeho výstupu, obvykle `https://panblb69-design.github.io/gamev2/`.

Pokud repozitář nemá Pages dostupné kvůli tarifu/viditelnosti, GitHub to uvede v Settings → Pages; dostupnost nelze předpokládat. Vite má relativní `base: './'`, takže assets fungují i pod `/gamev2/`. Build obsahuje lokální assets; offline první načtení/PWA cache není součástí M0. Uložené hry jsou vázané na prohlížeč a origin: pro přenos mezi lokální a publikovanou verzí použijte export/import JSON.

## Jak vyzkoušet M1

1. Zapněte pauzu. Vlevo **Koupit pozemek**, potom **Postavit halu** (výchozí obdélník 5,5,88,58).
2. V katalogu vyberte mytí M006, montáž M007, heliový tester M011, povrch M010 a balení M012. U každého klikněte **Umístit** a pak na mapu. Nechte mezi stroji alespoň dvě volná pole.
3. Vpravo najměte skladníka a pět operátorů. Zrušte režim umisťování, klikněte na stroj: připojte elektřinu a vzduch, přiřaďte volného operátora a spusťte jeho recepturu. Opakujte pro všech pět.
4. Objednejte na jeden výparník: 56 desek, 27 lamel, 2 výztuhy, 1 vstupní a 1 výstupní trubku, 1 blok, 2 záslepky, 1 obal, 4 l vody, .01 l čističe, .001 m³ helia a .01 l chemie. Pro zakázku HX-001 potřebujete 10 dobrých kusů; objednejte rezervu na neshody. Čas spusťte na 10×.
5. Za 4 herní hodiny dorazí vstupy. Skladník je převeze k mytí a následně k montáži. Jakmile jsou jádra v centrálním skladu, zadejte počet a **Odeslat jádra (2 dny)**.
6. Po návratu pokračuje test, povrch a balení. Přijměte zakázku HX-001 a po vyrobení 10 dobrých zabalených kusů klikněte **Expedovat HX-001**. Pohledávka se inkasuje za 30 dní.
7. Při poruše najměte údržbáře, objednejte sadu náhradních dílů a v kontextu vadného stroje klikněte Opravit. Neshodný výrobek se neopravuje automaticky.

Volitelně pořiďte lis, lamelovací automat a dělení trubek a vyrábějte komponenty ze surovin. V levém panelu je rozbalovací průvodce. Pravý i levý panel lze samostatně posouvat. Uložení/načtení a JSON záloha fungují i během rozpracované výroby.

## Jak vyzkoušet M2–M6

1. V **Řízení závodu → Sklady a doprava** postavte zónu s kg/m³ kapacitou, pořiďte VZV a rampu. Objednávku můžete nasměrovat do zóny. Pro přepravu musí existovat průchozí trasa a směnový skladník, nebo vyzkoumané AGV/dopravník.
2. V **Plánování a obchod** načtěte trh nebo sjednejte rámcovou smlouvu. Poptávku přijměte v hlavním panelu nebo předložte cenovou nabídku. Připravte MRP a uvolněte plán: nakoupí jen nedostatky, výrobu ani expedici nenahrazuje.
3. V **Lidé a údržba** nastavte směny, dvoučlenný tým, školení a servis. CAB vyžaduje technologickou kvalifikaci. Pracovní úloha nezačne těsně před koncem směny, pokud by se nestihla dokončit.
4. V katalogu umístěte M008 a M009. V **Rozvody a kvalita** pořiďte zdroje a trasy potřebných médií a zapněte vlastní CAB trasu MRP. Kromě rozvodů musíte objednat tavidlo, dusík a vodu. Odpad zlikvidujte nebo prodejte; výsledek testu a rodičovské šarže jsou v přehledu.
5. V **Automatizace a MES** zahajte výzkum. Po skutečném dokončení lze robotizovat pracoviště, pořídit AGV, propojit výstup dopravníkem a nastavit automatické doplňování. Exportní varianta vyžaduje příslušný výzkum a balicí recept se dvěma obalovými sadami.
6. Uložte hru, obnovte stránku a načtěte ji. Školení, výzkum, rozpracované cykly, doprava i pohledávky pokračují z uloženého stavu. Pravidelně exportujte JSON.

## Dokumentace

- [Architektura](docs/ARCHITECTURE.md), [datové modely](docs/DATA_MODEL.md)
- [Roadmapa a první vertikální řez](docs/ROADMAP.md)
- [Herní předpoklady](docs/BALANCE_ASSUMPTIONS.md), [rozhodnutí](docs/DECISIONS.md)
- [Výsledky ověření](docs/VALIDATION.md)
- [Akceptace M0–M6](docs/MILESTONE_ACCEPTANCE.md)
- [Stav a otevřené úkoly](docs/STATUS.md), [changelog](CHANGELOG.md)
