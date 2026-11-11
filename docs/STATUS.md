# Stav 0.6.1 — M0–M6 a první zakázka

M0–M6 mají implementovaný a testovaný výchozí rozsah. Přesnou mapu funkcí na důkazy a konkrétní herní zjednodušení obsahuje [MILESTONE_ACCEPTANCE.md](MILESTONE_ACCEPTANCE.md).

## Funkční cesta

Pozemek → hala → stroje/přípojky/pracovníci → poptávka nebo rámcová odvolávka → plán MRP a nákup chybějících surovin → příjem přes rampu/sklad → fyzické rezervované přepravy → lisování/lamely/trubky → čištění a montáž → kooperace **nebo** vlastní tavidlo/CAB → test těsnosti (neshoda do karantény) → povrch → balení → expedice → faktura → inkaso ve splatnosti.

Výzkum dále umožňuje robotizaci, dopravníky, AGV, MES doplňování a exportní variantu balení. Každá automatizovaná cesta používá stejné materiálové a ekonomické události. Žádné generování výrobků bez vstupů.

## Provoz a výkon

Prohlížečová simulace běží v samostatném Web Workeru; PixiJS a ovládání zůstávají na hlavním vlákně. Příkazy mají potvrzení, ukládání získá konzistentní snapshot z workeru. Snapshoty prezentace se posílají nejvýše přibližně 5×/s; render manipulace má samostatný update. Fronta wall-clock kroků je omezená: při přetížení se hra zpomalí, nikoli neomezeně zaplní zprávami. Simulační události a materiál se nezahazují.

Prázdný tick pouze čte čelo min-heap fronty. Stejně časované události se zpracují dávkově ve stabilním pořadí, potom se přepočítají dotčené stroje. Inventář má index item/location/ID a cache cest používá revizi mapy. Detailní zátěžová evidence se zapisuje lokálně do ignorovaného artifacts/performance.json.

## Uložené hry

Formát v3 migruje validní prázdný M0 v1 i M1 v2. Ukládá probíhající výrobu, dopravu, rampy, MRP rezervace, školení, výzkum, rozvody, faktury a výsledky kvality. Import nemění IndexedDB, dokud hráč nestiskne Uložit. Zálohujte přes export JSON.

## Doručení

Verze 0.6.0 byla připravena lokálně bez nasazení. Dne 2026-11-11 uživatel následně autorizoval nahrání, nasazení a kontrolu hratelnosti. Verze 0.6.1 přidává průvodce první zakázkou a přesnou nabídku nákupu. Nasazení používá main, protože prostředí github-pages pracovní větev odmítá. Lokální build sám nic nepublikuje; ověřit výsledek vzdáleného workflow.

## Další možné rozšíření mimo uzavřený rozsah

Segmentové řízení dopravního provozu, jednotlivé regálové sloty, tlakové ztráty rozvodů, další skutečně odlišné konstrukce výparníků po technickém zadání, rozsáhlé dlouhodobé archivování a ladění cen podle hraní. Nejsou uváděny jako existující funkce.
