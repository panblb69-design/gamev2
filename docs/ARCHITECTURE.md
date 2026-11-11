# Architektura M0–M6

TypeScript strict + Vite, PixiJS 8 WebGL přes FactoryRenderer, HTML panely. Bez backendu a vzdálených runtime služeb.

## Hranice vláken

`Simulation` je headless a neimportuje DOM. `FactoryEngine` vykonává příkazy a plánované události nad jediným stavem. `core/worker.ts` používá totéž jádro v dedikovaném Web Workeru; `BrowserSimulation` je prezentační proxy s potvrzenými příkazy, konzistentním snapshotem pro save a výměnou stavu při load. UI nevykonává výrobní příkazy lokálně. `FactoryEngine` v UI slouží jen k read-only skladovým dotazům.

RAF na hlavním vlákně vykresluje mapu a manipulační jednotky; fixed clock posílá dávky kroků workeru, nejvýše jednu dávku in-flight. Fronta má limit 50 čekajících kroků; přebytečný wall time se při přetížení zahodí. Simulační čas pak běží pomaleji, ale výrobní události a kusy se neztrácejí. Skrytá karta čas neposouvá, není offline dohánění.

## Čas a determinismus

CONFIG v core/time.ts je jediné měřítko času: 50 ms reálného fixed step, 120 s na herní den při 1×; odvozeno 36 herních sekund na tick. Uvnitř ticku se události zpracují na přesném herním čase, ne po zaokrouhlení. Lis tedy může mít takt kratší než tick a CAB přesně 36 cyklů/h.

Fronta je min-heap řazený podle at/seq. Stejně časované události se dokončí ve stabilní dávce a potom proběhne reconcile dotčených strojů. Prázdný tick čte jen čelo fronty. Změna příjmu označí stroje používající položku, změna vstupu či výstupu konkrétní stroj, kalendář/školení/servis může invalidovat celý provoz. PRNG LCG je součást save a používá ho jen simulace (kvalita, poruchy, trh a zpoždění dodavatelů).

## Moduly

- `core`: stav, fixed clock, worker/proxy.
- `manufacturing`: původní geometrický/provozní model, procesní katalog, queue, engine a události výroby/financí.
- `enterprise`: persistovaný stav M2–M6 a validované manažerské příkazy, kalendář a integrace rozšíření s engine přes explicitní Host API.
- `logistics`: fyzikální herní měrné veličiny, kapacity zón a indexy item/location/lot ID. Tytéž šarže a rezervace slouží lidem, VZV, AGV i dopravníkům.
- `world`: kolize, otočené půdorysy, porty a BFS, širší průchodnost pro VZV. Cache podle revize mapy a start/cíl; při stavbě ověřit zachování přístupu.
- `planning`: výrobky/BOM varianty, MRP a kapacitní rozpad podle skutečně postavených strojů.
- `workforce`: katalog profesí, kvalifikace, směny přes půlnoc a pokrytí celé délky úlohy.
- `infrastructure`: požadavky médií a souběžné využití připojeného zdroje.
- `automation`: výzkumné projekty; vlastní provoz využívá společnou dispatch/consume/complete cestu.
- `analytics`: čas ve stavech, A/P/Q/OEE bez dvojího použití faktorů, oddělená hotovost a ocenění zásob.
- `save`: Zod v3, důležité reference/rezervace/události, migrace v1/v2, IndexedDB a JSON.
- `ui` + `render`: řízení a prezentace. Statický grid je jedna geometrie, změny hal/strojů/zón/rozvodů jsou cacheované. Manipulace je samostatná agregovaná vrstva, žádný sprite na každou lisovanou desku.

## Invarianty

Peníze jsou safe integer haléře, materiál se zaokrouhluje na 6 desetinných míst. Transport rezervuje množství konkrétní šarže; dostupné = quantity − rezervované přepravou − obchodní rezervace. Cyklus jednou spotřebuje skutečně doručené vstupy, uloží jejich cenu a původ a naplánuje dokončení. Ocenění se přenáší do WIP/produktu; náklad prodaného materiálu vzniká expedicí, ne podruhé při nákupu. Vadný test nejde do dobré výroby. Expedice odečte produkt, vystaví fakturu a budoucí inkaso.

Kontejnery mají hmotnostní limit, větší příjem a přepravní požadavky se dělí bez ztráty množství/ceny. Kapacita cíle zahrnuje rezervované příjmy. Souběžné jízdy sdílející trasu se neprotnou; rezervace celé trasy je záměrně konzervativní. Směnový tým vybírá dostupného kvalifikovaného člověka, automatizace nahrazuje pouze personální podmínku.

## Retence a výkonové meze

Nulové šarže a dokončené přepravy/dodávky se odstraňují. Denní mzdy mají jednu budoucí událost, denní report posledních 366 dnů a ledger posledních 200 pohybů. Příkazy mají limit 10 000 vnějších ID; interní kalendářové příkazy ho nezaplňují. Strukturovaná genealogie a inspekce zůstávají v save s explicitními limity schématu; neexistuje neomezený archiv.

Benchmark ve tests/performance.test.ts pokrývá 144 stanic, 200 lidí a 5000 šarží. Zaznamenává i p95/max tick, ne pouze průměr. Podrobnosti a hranice jsou v MILESTONE_ACCEPTANCE.md; nelze jej zaměnit za garanci 60 FPS nebo desetiletého provozu na libovolném zařízení.
