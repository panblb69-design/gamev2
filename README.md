# Factory Empire — M1

Česká průmyslová hra podle zadání v0.1. **První výrobní průchod M1** navazuje na technický základ M0. M2–M6 nejsou dokončené. Bez backendu a vzdálených runtime API.

## Spuštění

Node.js 22+ (ověřeno 24.22.1), npm 11. V existujícím checkoutu:

```sh
npm ci
npm run dev
```

V prohlížeči otevřete adresu vypsanou Vite. Mapu zobrazuje PixiJS s WebGL; prohlížeč musí WebGL podporovat. V cloud sandboxu s nezapisovatelným domovským adresářem přidejte k npm příkazům `--cache /tmp/factory-npm`.

## Co skutečně funguje

- WebGL mapa 100×70 m, metrová mřížka, kamera, výběr a umisťování.
- Kapitál 300 mil. Kč; nákup pozemku, obdélníková hala, stroje, servisní mezery a průchodnost. Rotace 0/90°.
- Pauza/1×/2×/5×/10×, seedovaná headless simulace a plánované události; 120 sekund při 1× = den.
- Nákupy s dodáním po 4 h, agregované šarže/FIFO, rezervace a viditelné přepravy. Stroje potřebují přípojky, operátora a skutečné vstupy, výstupní buffer je omezený.
- Vlastní výroba desek/lamel/výztuh/trubek nebo jejich nákup → čištění → montáž → externí tavidlo/CAB (2 dny) → heliový test → povrch → balení.
- Neshodné kusy v karanténě, mzdy a energie, jednoduché poruchy a opravy.
- Dvě jednorázové zakázky, skutečná expedice a vystavení faktury, inkaso až za 30 dní.
- IndexedDB save v2, migrace prázdného M0 save, JSON export/import a validace rozpracovaných vazeb. Ruční ukládání, doporučený export pro zálohu.

Přesná zjednodušení a otevřené části v [STATUS.md](docs/STATUS.md). Návrhové ceny a spotřeby jsou **neověřené herní hodnoty**, nikoli reálné technické údaje.

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

## GitHub Pages

Workflow `.github/workflows/pages.yml` ověřuje lint, testy a build a nasazuje `dist/` oficiálním Pages artifact deploymentem. Běží po push do `main` či `feat/factory-empire-m0`; lze ho spustit i ručně.

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

## Dokumentace

- [Architektura](docs/ARCHITECTURE.md), [datové modely](docs/DATA_MODEL.md)
- [Roadmapa a první vertikální řez](docs/ROADMAP.md)
- [Herní předpoklady](docs/BALANCE_ASSUMPTIONS.md), [rozhodnutí](docs/DECISIONS.md)
- [Stav a otevřené úkoly](docs/STATUS.md), [changelog](CHANGELOG.md)
