# Rozhodnutí

M0 respektuje doporučený stack. Nezakoupená parcela slouží pro plánovací mapu; nákup a stavba až M1. Čas simuluje celé dny, nikoli směny (M4). Není simulována offline výroba. Neexistující receptury a spotřeby nejsou vymyšlené; catalog uvádí neznámé hodnoty explicitně. Perzistence v1 přijímá pouze stavy vytvořitelné v M0. M1 musí přinést migraci a validační pravidla nových entit.

M001–M003 jsou interpretovány jako jedna kombinovaná sestava odvíječ/podavač/lis; katalog ji eviduje pod M001 s cenou 26 mil. a půdorysem 13×5 m, nikoli jako tři samostatné linky po 26 mil. M002/M003 nejsou samostatně kupovatelné položky. Potvrdit před nákupním modelem M1.

## M1

Uživatel autorizoval pokračování M1–M6. První navazující implementace dodává skutečný M1 průchod; etapy M2–M6 zůstávají samostatné navazující práce, nikoli předstírané hotové funkce. Pro cestu v M1 lze nakoupit všechny konstrukční komponenty; vlastní lis/lamelování/trubky jsou alternativní výrobní cesta. Čištění přidává explicitní mezistav sady W002 před montáží (konstrukční BOM výrobku se nemění). Neznámé spotřeby doplněné pro běh jsou výslovně herní neověřené hodnoty v BALANCE_ASSUMPTIONS.md.

Procesní recepty jsou v manufacturing/catalog.ts, původní data/catalog.ts zachovává návrhové definice a BOM. Kooperace M1 zahrnuje obě operace tavidlo a CAB, lokální M008/M009 zatím nejsou umístitelné. V2 save má podporovanou migraci v1; formát IndexedDB databáze zůstává stejný (mění se obálka JSON, nikoli object store). Základní power/air připojení nahrazuje plnou editovatelnou síť do M5, nikoli chybějící podmínku energie.
