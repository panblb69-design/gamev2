# Stav implementace

## M0 hotovo

Nový webový projekt, strict TS, oddělené headless jádro a renderer adapter, WebGL metrová mapa a kamera, čas/rychlosti/seed, počáteční finance a české UI, ruční IndexedDB save/load + export/import + validace, jednotkové a browser testy, dokumentace.

## Částečně / záměrné hranice

Datový základ obsahuje katalog zařízení a materiálů, BOM a montáž/balení. Neobsahuje kompletní proveditelné recepty FE-HX001: chybí kvantifikace surovin, čištění, médií, externí kroky a kvalita. Montážní recept nyní reprezentuje kusovníkový návrh, ne validovaný proces čištění. Pole neurčená v zadání mají null / prázdné profily. Obecné typy zaměstnanců, zásob a úloh existují, nejsou běžící systémy. M0 perzistence odmítá jejich nenulové kolekce. Migrace má explicitní verzi a odmítnutí nepodporované verze, ale zatím žádnou starší verzi k převodu.

Výkon: grid je jedna statická geometrie; tick neprochází budoucí entity. FPS je skutečná metrika aktuální scény. Zátěž stovek strojů a 200 lidí zatím nelze testovat, protože příslušné systémy neexistují. Tick měří pouze cenu M0 kroku, není benchmark budoucí výroby.

## M1–M6 nehotovo, neimplementováno

Žádné nákupy parcely/strojů, stavby, výrobní cykly, logistika, zaměstnávání, rozvody, kooperace, kvalita, faktury, inkaso či expedice. Plné akceptační scénáře T01–T10 nejsou spuštěny. M1 rozděleno do tří navazujících úkolů v ROADMAP.md.

## Otevřené úkoly

1. M1a: příkazy a jedinečná ID nákupů, vlastnictví pozemku, hala, obsazenost a servisní přístupy, test T01.
2. M1b: doplnit a ověřit jednotky receptur, vstupy/rezervace/výstupy a stavové přechody, elektřina, personál a první fyzický přesun; testy T02–T05.
3. M1c: zpožděná kooperace a kvalita, balení, expedice a splatnosti, verzované migrace a testy T06–T10.

Každý cloud úkol má izolované prostředí; používat existující checkout, nezakládat worktree bez požadavku uživatele.

## Ověření aktuálního běhu

2026-11-10: typecheck v rámci produkčního buildu, lint a 20/20 jednotkových testů prošly. Browser smoke v systémovém Chromiu se softwarovým WebGL prošel (1/1): mapa, pauza, rychlost, IndexedDB save/load, výběr polí, kamera, odmítnutí poškozeného importu; žádné pageerror. Test odhalil a opravil záporný první RAF delta (timestamp snímku může předcházet inicializačnímu performance.now). Screenshot je lokálně v ignorovaném test-results/m0-desktop.png. Browser smoke netestuje výrobní simulaci ani hardware GPU výkon.
