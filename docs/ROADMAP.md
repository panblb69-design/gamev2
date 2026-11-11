# Roadmapa

Výchozí implementace zadání v0.1 je uzavřená přes M0–M6. Akceptace a omezení: [MILESTONE_ACCEPTANCE.md](MILESTONE_ACCEPTANCE.md).

- **M0:** projekt, mapa, čas, kapitál, modely, save/load.
- **M1:** první výrobní a ekonomický průchod FE-HX001.
- **M2:** sklady, kontejnery, kapacity, FIFO, VZV, rezervace tras, rampy a okna příjmu.
- **M3:** MRP, výrobní příkazy, nabídky, rámcové smlouvy, odvolávky, sankce, kapacita a cash flow.
- **M4:** profese, směny a týmy, kvalifikace, absence, školení, poruchy a servisní plán.
- **M5:** vlastní tavidlo/CAB, média a sítě s kapacitou, odpady a genealogie.
- **M6:** robotizace, AGV, dopravníky, výzkum, exportní balení a MES/OEE.

## Způsob ověření

1. Regrese M0/M1 a testy jednotlivých nových mechanismů.
2. Společná kampaň od surovin přes lokální CAB a exportní variantu až k inkasu po save/load.
3. Headless benchmark 144 stanic / 200 lidí / 5000 šarží.
4. Browser kontrola workeru, mapy, ovládání všech přehledů a perzistence.
5. Typecheck, lint a produkční build včetně samostatného worker assetu.

## Případná navazující práce

1. Herní testování a úpravy balancu podle skutečných odehraných zakázek.
2. Jemnější doprava po segmentech a jednotlivé skladové pozice.
3. Nový fyzický výrobek s ověřeným BOM/procesem a delší benchmarky.

Verze 0.6.0 byla dokončena lokálně podle původního pokynu. Uživatel následně autorizoval publikaci a herní kontrolu; 0.6.1 obsahuje první UX opravy. Další balancovací změny vycházejí z odehraných zakázek, nikoli z automatického navyšování tržeb.
