# Stav implementace — navazující vývoj M1–M6

## M0 hotovo

Strict TS/Vite/PixiJS, WebGL mapa, kamera, fixed-step hodiny, české UI, IndexedDB a export/import. Nový formát save v2 migruje platný prázdný M0 save v1. Po importu není starší save přepsán, dokud hráč sám neuloží.

## M1 implementovaný první průchod

- Nákup parcely, obdélníková hala, nákup a orientace strojů, kolize a metrový servisní pruh. BFS ověřuje dostupnost všech strojů ze skladu. Jednoznačné ID příkazu zabraňuje dvojímu účtování; UI filtruje nechtěné dvojkliky.
- Nákup komponent nebo surovin a médií, platba při objednání, dodání po 4 herních hodinách. Sklad má omezenou společnou kapacitu. Skladové jednotky jsou šarže, nikoli jednotlivé díly.
- Lis desek/výztuh, lamelování a příprava trubek se spotřebou surovin a odpadem; alternativně nákup komponent. Čištění přesného konstrukčního BOM → očištěná sada → montáž jádra.
- Připojení elektřiny a vzduchu, operátor přiřazený právě jednomu stroji, instalovaný souběžný příkon do 500 kW. Energie se účtuje jednou za zahájený cyklus.
- Vstupní materiál musí být skutečně dopraven do vstupního bufferu. Všechny přepravní úlohy rezervují množství konkrétní šarže; FIFO po pořadí přijetí. Skladníci je provádějí po průchozích trasách. Mapou se pohybují agregované manipulační jednotky. Výstupy čekají v omezeném bufferu na odvoz.
- Explicitně odesílaná kooperace tavidla + CAB za cenu a s dobou 2 dny; jádra nejsou mezitím interně k dispozici.
- 100% heliový test, seedované 3% riziko neshody → karanténa. Pouze dobré jádro pokračuje přes povrchovou úpravu a balení. Dvě záslepky a jeden obal se spotřebují až při balení.
- Dvě jednorázové zakázky; expedice celé zakázky ze skladu dobrých výrobků → faktura a pohledávka → inkaso za 30 dní. Žádné přičítání peněz při výrobě.
- Najímání operátorů, skladníků a údržbářů, denní mzdy a závazky při nedostatku cash. Výrobní opotřebení, seedovaná jednoduchá porucha a hodinová oprava vyžadující údržbáře a náhradní díl.
- Uložení rozpracovaného cyklu, rezervací, přeprav, kooperací a pohledávek; validace schématu a klíčových vazeb.

## Zjednodušení M1

Jeden automaticky dostupný společný sklad v [2,2], jedna hala; stroj se po umístění zprovozní bez samostatné instalační lhůty. Přípojky se zaplatí a vedou po průchozí trase k distribučnímu bodu, neexistuje editovatelná síť kabelových polí. Vzduch je základní příznak připojení, bez dimenzování kompresoru a průtoků. Personál má zatím nepřetržitou směnu; rozvrhy a specifické kvalifikace jsou M4. Dopravce projde trasu od skladu k vyzvednutí, do cíle a zpět; převod rezervovaného množství se dokončí na konci tohoto úkolu. Nemáme dosud skladové regály, rampy ani VZV. Skladová kapacita je zjednodušený součet množství různých jednotek.

Výrobní kalkulace: materiál je držen v ocenění šarží, náklad spotřebovaných vstupů se přenáší na WIP/produkt, výdaj je při nákupu a náklad při expedici nebo zmetkování. Mzdy a energie jsou přímo provozní náklady. Investice nejsou okamžitý účetní náklad; odpisy zatím nejsou. Kooperace přidává cenu do ocenění vráceného jádra. Jde o herní zjednodušení, nikoli účetní software.

Zakázky nejsou dosud generované, sankce a rámcová smlouva neexistují. Neshody se neexpedují ani neopravují; nemáme prodej odpadu a jeho likvidaci. Chybí podrobný kapacitní/OEE report. Dílčí vlastnosti celého MVP tedy zůstávají otevřené, přesto je implementovaná cesta od nákupu po reálnou expedici a inkaso.

## M2–M6 nehotovo

M2: základ FIFO, rezervace a průchodnost již existují, ale chybí více fyzických skladů, pozic, kontejnery s nosností, VZV, rampy a dopravní kolize.
M3: základ objednávky/faktury existuje, ale chybí MRP, rámcové smlouvy, sankce a kapacitní kalendář.
M4: základ mezd, poruch a oprav existuje, ale chybí směny, kvalifikace, školení a servisní kalendář.
M5: vlastní CAB/tavidlo, detailní média, vodní/nitrogenní sítě a sledovatelnost se neimplementovaly.
M6: roboty, dopravníky, AGV, MES, nové výrobky a výzkum se neimplementovaly.

## Ověření

Jednotkové a integrační testy jsou v tests/core.test.ts a tests/production.test.ts. Pokrývají T01–T10 v rozsahu M1 (T05 skutečnou montáž 2×15 a 3×15 za hodinu; vlastní CAB limit 36/h je jen katalogová kontrola, nikoli provoz vlastní pece). Scénář celé zakázky vyrábí z nakoupených komponent, kooperuje, testuje, balí, expeduje a po save/load inkasuje fakturu. Samostatný seed zaručeně vyvolá neshodný test, jiný test vynutí poruchu opotřebením a ověří opravu. Dlouhý běh kontroluje nezáporné zásoby a omezené fronty.

Browser smoke ověřuje WebGL a základ M0 i M1 nákup/stavbu/přípojky/operátora, důvod zastavení a obnovení závodu po reload. Browser smoke neprochází celou výrobu po jednotlivých kliknutích; tu pokrývá headless integrační test skutečného stejného jádra.

Testovací screenshoty a výstupy jsou ignorované v test-results/. Výkon stovek aktivních výrobních zařízení a 200 zaměstnanců zatím není zátěžově ověřen. Každý cloud úkol má izolované prostředí; použít existující checkout, nezakládat worktree bez požadavku uživatele.

Před odesláním verze 0.2.0 proběhlo 34 jednotkových/integračních testů a 2 browser testy, lint a produkční build. M0 zůstává dostupný migrací save. Publikaci GitHub Pages provádí existující workflow po push do pracovní větve; úspěch vzdáleného běhu je samostatný stav, nikoli důsledek lokálního buildu.
