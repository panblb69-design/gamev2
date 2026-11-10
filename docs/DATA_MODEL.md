# Datové vazby M1

GameState v2 přidává Factory, zatímco zachovává seznamy geometrických MachineInstance, InventoryLot a Employee. Factory.machines drží provozní vazbu 1:1 na geometrický stroj: recept, operátora, přípojky, aktuální cyklus, buffer a výsledky. Peníze jsou integer haléře. Finance rozlišuje cash, pohledávky, závazky, výnosy a náklady.

Item má stabilní ID, jednotku a druh. Konstrukční Product BOM obsahuje 56/27/2/1/1/1 komponent a samostatné 2 záslepky + 1 obal. Proveditelná Operation čištění spotřebuje konstrukční díly a vytvoří očištěnou sadu W002; montáž ji spotřebuje a vytvoří W001. Kooperace spotřebuje W001 a po 2 dnech vytvoří W004. Test, povrch a balení jsou další operace, neshodný W004 má quality=quarantine a není vstupem dalších dobrých operací.

InventoryLot je agregovaná šarže s množstvím, rezervací, lokalitou, kvalitou, batchId a celkovým costMinor. Lokalita je warehouse, machine-ID:in nebo machine-ID:out. Při částečném přesunu se množství i ocenění rozdělí. Původ je zatím řetězec identit vstupních šarží; strukturovaná genealogie je M5. Vstupní limit je modelový, výstupní je reálně vynucený; jedna dopravní dávka vstupu na cyklus nepřesahuje inputCapacity. Sklad má společnou zjednodušenou kapacitu.

Přeprava rezervuje lotId/quantity, ukládá trasu, skladníka a čas. Dodávky i kooperace mají zaplacené ocenění, plánovaný čas a vlastní událost. Všechny časy jsou v herních sekundách. Event min-heap řadí podle at a stabilního seq. Save ukládá tuto frontu i rozpracované vstupní ocenění cyklu, takže reload znovu nespotřebovává materiál.

Contract má množství, cenu, termín, splatnost a stav offer/accepted/shipped/paid. Invoice vzniká expedicí celé zakázky a jednou událostí payment. Termín zatím nevyvolává sankce. Výnos vzniká při expedici, hotovost až při payment; pohledávka musí odpovídat součtu neuhrazených faktur. Investice, skladové ocenění a provozní náklady se nesmějí účtovat dvakrát.

Employee má role operator/warehouse/mechanic, wageMinor za den, dostupnost a zatím jedinou continuous směnu. Jeden operátor je přiřazen jednomu stroji; jeden skladník má jednu aktivní úlohu; mechanik musí být dostupný pro opravu. Rozšíření profesí/směn je M4.

Zod schéma kontroluje typy, limity, unikátní ID, rezervace a důležité reference/události. Podporuje migraci validního prázdného M0 v1. Nejde o anticheat: ručně vytvořený strukturálně platný JSON není důvěryhodný účetní doklad.
