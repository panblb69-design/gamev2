# Roadmapa M0–M6

## M0 — dodáno

Mapa, kamera, hodiny, kapitál, modely, IndexedDB, testy a dokumentace.

## M1 — implementovaný první výrobní průchod

Nákup parcely a obdélníkové haly, umístění strojů, přípojky, nákup materiálu, výroba komponent nebo jejich nákup, čištění, montáž, kooperace, heliový test, povrch, balení, expedice a inkaso. Základ personálu, mezd a oprav. Save v2 a migrace M0. Konkrétní omezení v STATUS.md; plné MVP není označeno za dokončené.

## M2 — další implementační etapa

1. Oddělit inventory/logistics od engine, přidat index podle item/location, dirty reconcile a benchmark 100–300 strojů, 200 pracovníků, tisíce šarží.
2. Fyzické skladové zóny/pozice a kapacity v objemu/hmotnosti; paletové kontejnery a nosnost. Zachovat FIFO a rezervace přes save.
3. VZV a šířka uliček, dopravní konflikty, rampy/dodací okna a částečné přepravy.

## M3 — plánování a obchod

Generované nabídky + rámcová smlouva a odvolávky, MRP/rezervace zakázky, zpoždění dodávek, sankce a kapacitní kalendář. Oddělit ledger a faktury, účetní report zásob/WIP a cash flow, OEE bez dvojího použití faktorů.

## M4 — personál a údržba

Směnový kalendář, samostatné profese a kvalifikace, školení a absence. Preventivní údržba, servisní plán, zásoby dílů a MTBF/MTTR, specifické poruchy podle technologie.

## M5 — vlastní technologie a média

Lokální tavidlo/CAB se skutečnými kapacitami a pořadím, média a jejich zásoby/průtoky, kompresor, voda/dusík/odsávání, odpadní hospodářství a strukturovaná genealogie šarží.

## M6 — automatizace a MES

Dopravníkové hrany, AGV/roboty se sdílenými logistickými rezervacemi, výrobní analytika/OEE, další produktové varianty a výzkum. Každý nový produkt musí mít validovaný BOM a samostatné procesní recepty, nikoli automatický generátor příjmů.

Každou etapu uzavřít headless integračními testy, browser kontrolou uživatelského toku a buildem. Práce M1–M6 je autorizovaná; navazovat tímto pořadím, nesmíchat nedokončené etapy do tvrzení o hotové hře.
