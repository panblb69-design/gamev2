# Datové vazby

Katalog Item: stabilní ID, český název, jednotka a druh (raw/component/wip/product/medium/waste). Quantity = itemId + amount + unit. Product má verzovaný BOM; konstrukční komponenty a obalové vstupy zůstávají oddělené. WIP stavy rozlišují montáž, očištění, tavidlo, pájení, testování, povrch a hotový zabalený produkt.

Recipe: verze, vstupy/výstupy, čas v herních sekundách, médium, odpad a stav ověření. Pro M0 jsou definovány BOM montáže a balení, nikoli smyšlené hmotnosti surovin či spotřeby médií. Chybějící procesní recepty blokují budoucí spuštění výroby, nikoli tvoří kusy zdarma.

MachineDefinition odděluje typ od MachineInstance; půdorys, porty, cena v haléřích, média, personál, takt, buffery a spolehlivost. Neurčené hodnoty jsou null, nikoli odhadnutá nula. Instance obsahuje stav, orientaci, pozici a podmínku. Stavový automat M1: unplaced → placed → installing → waiting_for_utilities → idle → running, pak starved/blocked/changeover/maintenance/fault. Přechod running vyžaduje validaci vstupů, výstupů, médií a personálu.

Finance: celočíselné haléře; hotovost, pohledávky, závazky, výnosy, náklady a investorův podíl odděleně. Účetní události versus kalkulační položky nesmějí být účtovány dvakrát. Počáteční kapitál není výnos. Budoucí faktura vzniká expedicí a inkaso až ve splatnosti.

InventoryLot má šarži, množství, rezervaci, místo a stav kvality. Employee a LogisticsTask jsou pouze typové kontrakty; instance v M0 jsou prázdné. Save validuje právě podporovaný M0 stav a odmítá nenulové budoucí kolekce; při M1 se rozšíří schema i migrace.
