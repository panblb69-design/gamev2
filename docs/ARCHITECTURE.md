# Architektura M1

TypeScript strict + Vite, PixiJS 8 WebGL přes rozhraní FactoryRenderer. HTML panely, bez backendu a vzdálených runtime API. Stav rendereru a UI není zdroj výrobních ani ekonomických výsledků.

## Čas a události

Simulation je headless a vlastní serializovatelný GameState. FixedClock převádí reálné milisekundy na integer tick po 50 ms; den trvá 120 s reálného času při 1×. Jeden tick tedy posune svět o 36 herních sekund. FactoryEngine zpracuje v rámci každého ticku všechny splatné události na jejich přesném herním čase, nikoli na zaokrouhleném ticku: i lis s kratším taktem má správný nominální výkon.

Události (výrobní cyklus, přeprava, dodávka, kooperace, faktura, mzdy, oprava) jsou v binární min-heap frontě se stabilním pořadím at/seq. Prázdný tick pouze přečte čelo fronty; neprochází stroje, lidi a sklad. Při materiálové nebo provozní události se reconcile podmínky strojů a naplánují další činnosti. Tento první reconcile prochází aktuální stroje a zásoby; další optimalizace M2 je index item/location a dirty fronta dotčených strojů. Nelze jej vydávat za hotový benchmark stovek zařízení.

PRNG je seedované LCG ve stavu save. Spotřebovává se pouze pro kvalitu a poruchy. Renderer jej nepoužívá. Skrytá karta zastaví hodiny; není offline výroba. Omezený frame delta brání neomezenému catch-up po přetížení.

## Moduly a invariants

- core: clock, GameState a vstupní bod kroku simulace.
- manufacturing/model + catalog: stav závodu, události a procesní parametry. Vlastní původní catalogue v data odděluje základní technické definice a konstrukční BOM od proveditelné trasy.
- manufacturing/engine: validace příkazů, rezervace, výroba a přenos ocenění, logistika, kooperace a finance. Systémy sdílejí jediný stav; při dalším rozšíření se oddělí do modulů se společnými událostmi, ne do nezávislých dem.
- world/path: rotované půdorysy, kolize, porty a BFS. Cache cest je klíčovaná revizí mapy a start/cíl; umístění kontroluje dostupnost existujících portů proti novému půdorysu.
- save: Zod schéma v2, vazby šarží/rezervací/událostí, migrace prázdného v1, IndexedDB transakce a JSON.
- ui: příkazy s unikátním ID, zobrazení při změně dat; žádná tvorba peněz či výrobků v event handleru.
- render: statický grid, vrstva haly/strojů/přípojek, štítky a oddělená agregovaná vrstva manipulace. Scéna se mění při změně stavu, nikoli celá mapa každý frame.

Příkaz se zapíše do deduplikačního seznamu až po úspěšné validaci a změně. Čísla peněz jsou integer haléře, transakce používají safe integers. Množství surovin jsou zaokrouhlená na šest desetinných míst. FIFO rezervuje množství konkrétní šarže; dostupnost = quantity − reserved. Cyklus spotřebuje vstupy pouze jednou při startu; jeho ocenění, vazby a čas jsou persistované až do výstupu. Karanténa neprojde filtrem dobrých vstupů. Výstupní buffer zahrnuje dosud neodvezené množství, včetně rezervovaného.

## Omezené růsty a další výkon

Přepravní a dodavatelské záznamy se po dokončení odstraňují, nulové šarže se mažou; denní mzdy mají jednu budoucí událost. Účetní přehled drží posledních 200 pohybů. Historie příkazů má explicitní limit 10 000 (další příkaz se odmítne), katalog zakázek je zatím konečný. Neexistuje objekt pro každý jednotlivý vyrobený díl.

Další kroky: indexy skladů, dirty queue strojů, specializované skladové pozice, cesta s nosností a šířkou, pooling dynamických objektů a výkonový benchmark pro stovky strojů/200 lidí. Panel vykazuje skutečné FPS, tick ms a aktuální počty entit a aktivních úloh.
