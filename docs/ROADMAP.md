# Roadmapa

- M0: mapa, kamera, čas, kapitál, katalogy a modely, IndexedDB, export/import, testy. Bez výroby a automatických příjmů.
- M1 (samostatný úkol): koupě parcely a haly, kolize/průchodnost, nákup strojů s idempotencí; energie, receptury a buffery, fyzická logistika, personál; kooperace, kvalita, balení, expedice a faktura se splatností.
- M2: kontejnery, VZV, FIFO, dopravní omezení.
- M3: MRP, kontrakty a kapacitní plánování.
- M4: směny, kvalifikace a údržba.
- M5: vlastní CAB, tavidlo, média a sledovatelnost.
- M6: automatizace, MES, nové produkty.

## První vertikální řez M1

První PR: příkazy nákupu parcely/haly/stroje, kolize a T01. Druhý PR: sklad, rezervace, montáž, elektřina, logistický pohyb a T02–T05. Třetí PR: kooperace, karanténa, balení, expedice, splatnost a T06–T10. Každý PR musí mít testy skutečných materiálových a finančních změn.

T01–T10 plného výrobního scénáře v M0 nejsou implementovány ani označeny za prošlé; M0 ověřuje pouze základ BOM, nominálních kapacit, hodin a save/load prázdného závodu.
