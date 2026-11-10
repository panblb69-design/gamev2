# Datové vazby M1

GameState v2 přidává Factory, zatímco zachovává seznamy geometrických MachineInstance, InventoryLot a Employee. Factory.machines drží provozní vazbu 1:1 na geometrický stroj: recept, operátora, přípojky, aktuální cyklus, buffer a výsledky. Peníze jsou integer haléře. Finance rozlišuje cash, pohledávky, závazky, výnosy a náklady.

Item má stabilní ID, jednotku a druh. Konstrukční Product BOM obsahuje 56/27/2/1/1/1 komponent a samostatné 2 záslepky + 1 obal. Proveditelná Operation čištění spotřebuje konstrukční díly a vytvoří očištěnou sadu W002; montáž ji spotřebuje a vytvoří W001. Kooperace spotřebuje W001 a po 2 dnech vytvoří W004. Test, povrch a balení jsou další operace, neshodný W004 má quality=quarantine a není vstupem dalších dobrých operací.

InventoryLot je agregovaná šarže s množstvím, rezervací, lokalitou, kvalitou, batchId a celkovým costMinor. Lokalita je warehouse, machine-ID:in nebo machine-ID:out. Při částečném přesunu se množství i ocenění rozdělí. Původ je zatím řetězec identit vstupních šarží; strukturovaná genealogie je M5. Vstupní limit je modelový, výstupní je reálně vynucený; jedna dopravní dávka vstupu na cyklus nepřesahuje inputCapacity. Sklad má společnou zjednodušenou kapacitu.

Přeprava rezervuje lotId/quantity, ukládá trasu, skladníka a čas. Dodávky i kooperace mají zaplacené ocenění, plánovaný čas a vlastní událost. Všechny časy jsou v herních sekundách. Event min-heap řadí podle at a stabilního seq. Save ukládá tuto frontu i rozpracované vstupní ocenění cyklu, takže reload znovu nespotřebovává materiál.

Contract má množství, cenu, termín, splatnost a stav offer/accepted/shipped/paid. Invoice vzniká expedicí celé zakázky a jednou událostí payment. Termín zatím nevyvolává sankce. Výnos vzniká při expedici, hotovost až při payment; pohledávka musí odpovídat součtu neuhrazených faktur. Investice, skladové ocenění a provozní náklady se nesmějí účtovat dvakrát.

Employee má role operator/warehouse/mechanic, wageMinor za den, dostupnost a zatím jedinou continuous směnu. Jeden operátor je přiřazen jednomu stroji; jeden skladník má jednu aktivní úlohu; mechanik musí být dostupný pro opravu. Rozšíření profesí/směn je M4.

Zod schéma kontroluje typy, limity, unikátní ID, rezervace a důležité reference/události. Podporuje migraci validního prázdného M0 v1. Nejde o anticheat: ručně vytvořený strukturálně platný JSON není důvěryhodný účetní doklad.

## Formát v3 — M2–M6

GameState přidává Enterprise; Factory zůstává zdrojem výrobních událostí, takže nejde o oddělená dema. Enterprise je definováno přímo validovaným schématem v enterprise/state.ts a TypeScript typ je odvozený z tohoto schématu.

- zones / containers / vehicles / transport / docks: fyzické kapacity, typ manipulace, rezervovaný čas a vozidlo, příjmová okna a rampa. deliveryDocks/deliveryZones vážou objednávku na skutečné místo příjmu; z rampy odjíždí běžná fyzická přeprava.
- plans / allocations / frameworks / contractProducts / quotes / penalties: MRP, obchodní rezervace oddělená od transportu, odvolávky, produkt zakázky a cenové nabídky. Uvolnění plánu nakupuje skutečné nedostatky, ne výrobky.
- workerProfiles / rosters / service: směna, dovednosti, trénink/absence a týmy operátorů; interval servisních cyklů, počet poruch a součet oprav. Profese je datový katalog s mzdou a kvalifikacemi.
- utilities / links: zdroj média s kapacitou, cestou a zapnutím; každé médium je separátní hrana ke stroji. Připojení není dodání spotřebního média: voda/dusík/tavidlo/helium se navíc spotřebují z receptu.
- genealogy / inspections: stabilní batch ID, rodičovské šarže, operace, čas, množství a kvalita; výsledek testu konkrétní šarže. Historické kořeny importované z M1 mohou zůstat bez detailních rodičů.
- research / automatic / conveyors / replenish: běžící/dokončený výzkum, robotizované stroje, dopravníkové hrany a pravidla objednávek. Všechny pohyby používají stejný transportní a finanční mechanismus.
- metrics / reports: intervaly stavů, cykly a ideální čas pro OEE, denní ekonomický snapshot. Nejsou zdrojem peněžních transakcí.

V1 migruje validní prázdný základ, v2 doplní prázdné nové systémy a zachová rozpracované události M1. Žádná migrace nepřipisuje peníze, stroje ani hotové výrobky. IndexedDB object store se nemění; verze JSON stavu a verze databáze jsou odlišné věci.
