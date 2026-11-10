# Factory Empire — M0

Český desktopový základ průmyslové hry podle zadání v0.1. **M0 není hratelný výrobní řetězec.** Bez backendu a vzdálených runtime API.

## Spuštění

Node.js 22+ (ověřeno 24.22.1), npm 11. V existujícím checkoutu:

```sh
npm ci
npm run dev
```

V prohlížeči otevřete adresu vypsanou Vite. Mapu zobrazuje PixiJS s WebGL; prohlížeč musí WebGL podporovat. V cloud sandboxu s nezapisovatelným domovským adresářem přidejte k npm příkazům `--cache /tmp/factory-npm`.

## Co skutečně funguje

- Nezakoupená plánovací parcela 100×70 m, 1 pole = 1 m²; výběr polí, tažení mapy, zoom kolem kurzoru a tlačítka pro pohyb/zoom/vystředění.
- Fixed-step 50 ms, pauza/1×/2×/5×/10×; 120 sekund při 1× = jeden den. Skrytá karta čas neposouvá, dlouhé snímky mají omezený catch-up.
- Počáteční kapitál 300 000 000 Kč, 35% investor; finance oddělují cash, výnosy/náklady a pohledávky/závazky. V M0 se bez transakcí nemění.
- IndexedDB ruční uložení a načtení jednoho slotu, export/import JSON, runtime kontrola verze a dat. Neplatný import zachová rozehraný svět. Uložení není automatické; prohlížeč může své úložiště smazat, používejte export.
- Katalog materiálů a zařízení, přesný verzovaný BOM FE-HX001, návrhy montážní a balicí receptury. Celý proces a chybějící parametry čekají na M1.
- Panel skutečných FPS, času ticku a počtů entit/úloh (v prázdném světě nula).

Od startu lze prohlížet mapu/katalog, přepínat čas a uložit/načíst stav. **K expedici se v M0 dojít nedá.** Žádné fiktivní stroje, výrobky, zaměstnanci či příjmy.

## Kontroly

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npx playwright test
```

V cloudu lze použít systémový prohlížeč: `CHROMIUM_PATH=/usr/bin/chromium npx playwright test`. Jinak se použije instalovaný Playwright Chromium. Jednotkové testy: čas/rychlosti, determinismus a PRNG continuation, čtyři herní týdny bez vytváření peněz, BOM/jmenovité kapacity, schema a IndexedDB. Browser test: WebGL canvas, pauza/zrychlení, uložení/načtení, výběr, kamera a odmítnutí neplatného importu. Neověřují výrobní T01–T10, které patří M1.

## GitHub Pages

Workflow `.github/workflows/pages.yml` ověřuje lint, testy a build a nasazuje `dist/` oficiálním Pages artifact deploymentem. Běží po push do `main` či `feat/factory-empire-m0`; lze ho spustit i ručně.

První zapnutí v GitHubu:

1. Otevřete repozitář → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. V **Settings → Environments → github-pages** případně povolte nasazování z větve `feat/factory-empire-m0` (ochrana může ve výchozím stavu povolovat jen hlavní větev).
3. Otevřete **Actions → Deploy Factory Empire to Pages** a zopakujte poslední běh. Pro ruční Run workflow musí být workflow i ve výchozí větvi; před sloučením použijte Re-run jobs u běhu vytvořeného pushem.
4. Po zeleném kroku deploy otevřete URL z jeho výstupu, obvykle `https://panblb69-design.github.io/gamev2/`.

Pokud repozitář nemá Pages dostupné kvůli tarifu/viditelnosti, GitHub to uvede v Settings → Pages; dostupnost nelze předpokládat. Vite má relativní `base: './'`, takže assets fungují i pod `/gamev2/`. Build obsahuje lokální assets; offline první načtení/PWA cache není součástí M0. Uložené hry jsou vázané na prohlížeč a origin: pro přenos mezi lokální a publikovanou verzí použijte export/import JSON.

## Jak M0 vyzkoušet

1. Otevřete hru, ověřte kapitál 300 000 000 Kč.
2. Přetáhněte mapu, kolečkem přibližte, klikněte na pole a ověřte souřadnice vpravo.
3. Zapněte 10×: datum a čas se posouvají rychleji. Zvolte Pauza: čas stojí.
4. Klikněte Uložit, změňte rychlost a nechte čas plynout. Načíst obnoví uložený čas a rychlost.
5. Exportujte JSON; soubor lze načíst přes Import JSON a následně uložit. Neplatný soubor musí zobrazit chybu a zachovat současný stav.
6. Vlevo rozbalte katalog stroje; uvidíte jeho návrhovou cenu, půdorys a výkon. Nákup a výroba patří až M1.

## Dokumentace

- [Architektura](docs/ARCHITECTURE.md), [datové modely](docs/DATA_MODEL.md)
- [Roadmapa a první vertikální řez](docs/ROADMAP.md)
- [Herní předpoklady](docs/BALANCE_ASSUMPTIONS.md), [rozhodnutí](docs/DECISIONS.md)
- [Stav a otevřené úkoly](docs/STATUS.md), [changelog](CHANGELOG.md)
