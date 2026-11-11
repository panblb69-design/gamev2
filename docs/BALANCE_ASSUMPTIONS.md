# Neověřené herní hodnoty

Všechny ceny, rozměry, výkony a časy katalogu jsou návrhové herní hodnoty ze zadání v0.1, nikoli průmyslový ceník nebo homologovaná technologie. Kapitál 300 mil. Kč, podíl investora 35 % bez srážky z tržeb. Výchozí pozemek 100×70 m je pouze nezakoupená plánovací mapa (bez haly či výroby). Den = 120 s při 1×, tick = 50 ms. Počáteční datum 1. 1. 2026, 00:00 UTC je herní volba.

Scénář 149 mil. stavební investice + 74 mil. technologie bez tavidla a CAB + 77 mil. rezerva je rozpočtový návrh, nikoli již utracená částka. 56 desek a 27 lamel na kus; záslepky a obal až při balení. Instalace, média a hmotnost surovin nejsou kvantifikované: null znamená doplnit před M1. Modelové náklady 1480 Kč a prodej 1850 Kč nejsou automatické transakce.

## Doplněné neověřené hodnoty M1

Pozemek 50 mil. Kč, hala 10 000 Kč/m², elektrická přípojka stroje 20 000 Kč, vzduch 10 000 Kč. Nákup stroje používá původní katalogovou cenu. Společný příkon 500 kW, koeficient aktivní energie 0.6, energie 5 Kč/kWh. Nábor 3 000 Kč, mzda 1 800 Kč/den na osobu; continuous směna je pouze zjednodušení.

Materiálové ceny (Kč/jednotka) jsou v manufacturing/catalog.ts: deska 7, lamela 9, výztuha 12, trubka 30, blok 130, záslepka 2, obal 35; pájecí svitek/plech 85 Kč/kg, pás 90 Kč/kg, trubka 80 Kč/m. Dodání 4 herní hodiny. Kooperace tavidlo+CAB 250 Kč/jádro, 2 dny. Dodatečné dopravní náklady jsou zahrnuté v ceně služby. Nezaměňovat s ověřenými nabídkami dodavatelů.

Na sadu komponent: 2.1 kg svitku → 56 desek + .1 kg odpadu; .5 kg pásu → 27 lamel + .02 kg odpadu; .15 kg plechu → 2 výztuhy + .01 kg odpadu; 1.1 m trubky → pár trubek + .1 m odřezků. Zbývající hmotnost je obsažena ve vyrobených komponentech, kusové položky nemají dosud samostatnou hmotnostní metriku. Čištění 2 l vody + .01 l čističe, test .001 m³ helia, povrch 2 l vody + .01 l chemie. Jde o návrhové veličiny pro konzistentní materiálový tok, nikoli technologický předpis.

Kvalita: 3 % testovaných jader jsou neshodné, bez automatické opravy. Opotřebení .0001/cyklus, porucha pod stavem .5 nebo se seedovanou pravděpodobností .0005/cyklus. Sada náhradních dílů 5 000 Kč, oprava 1 herní hodina a přítomnost údržbáře. Výstupní buffer 120 množstevních jednotek, vstupní 5000. Reálný přepočet kapacit na objem/hmotnost patří M2.

Expediční služba stojí 30 Kč/kus a strhává hotovost při expedici. Cena obalové sady se do této služby znovu neúčtuje.

## M2–M6 — neověřené herní parametry

- Skladová zóna: 2 000 Kč/m²; hmotnosti/objemy položek jsou v logistics/warehouse.ts. Centrální příjem zachovává původní množstevní limit. Ruční přepravka 30 kg, VZV 1500 kg / 2 m/s / šířka 2 m / cena 2.5 mil. Kč, AGV 500 kg / 1.2 m/s / šířka 1 m / cena 4.5 mil. Kč. Rampa 0.5 mil. Kč, slot 15 minut. Kontejnery: bin 30 kg, paleta 1500 kg, tank 10000 kg.
- Trh: nová nabídka po 7 dnech a nejvýše 6 platných nepřijatých poptávek. Cenový návrh může být ±20 %, deterministická zákaznická tolerance 0–7 %. Objem nabídky 10–100 ks; splatnost 14/30/60 dnů. Po aktivaci trhu má dodávka modelové 10% riziko dodatečného 8h zpoždění. Rámcové odvolávky mají periodu 30 dnů, smlouva 1–36 měsíců. Sankce 0.5 % ceny za každý dokončený den zpoždění.
- Směny: 6–14 / 14–22 / 22–6 nebo continuous. Školení 10 000 Kč a jeden den; absence 1–30 dnů zadává hráč. Nábor zůstává 3 000 Kč. Denní mzdy a vstupní kvalifikace jsou v workforce/roles.ts (od 1 600 do 4 000 Kč). Původní M1 operátor zachovává širokou kvalifikaci; CAB vyžaduje explicitní školení nebo technologa.
- Zdroje stojí 1 000 Kč na jednotku souběžné kapacity a rozvod 100 Kč/metr. Vlastní tavidlo má takt 72 s a .01 kg tavidla/kus. CAB 100 s/kus, .2 m³ dusíku a 1 l chladicí vody na cyklus, souběžná kapacita: dusík 4, voda 3, odsávání 5. Tato čísla nejsou reálné průtokové dimenzování pece; jde o herní kapacitní body. Aktivní odběr energie a další materiálové vstupy zůstávají v procesních datech.
- Kovový odpad: 20 Kč/kg výnos, neshodná jádra a jiný odpad: 5 Kč/kg likvidace. Kvalita nikdy není automaticky změněna na prodejnou.
- Výzkum: automatizace 1 mil. Kč / 2 dny; exportní balení 0.5 mil. Kč / den; MES 0.25 mil. Kč / den. Robotizace stroje 2 mil. Kč, dopravník 5 000 Kč/metr, rychlost .5 m/s, dávka do 100 kg. AGV spotřebuje 0.25 Kč/úlohu a dopravník .10 Kč/úlohu; ostatní provozní ceny jsou zjednodušené.
- FE-HX001-P: stejný výparník, 2 obalové sady místo jedné, balicí takt 75 s, návrhová prodejní cena 2 050 Kč. Konstrukční BOM jádra se nemění.

Rozpočet stress testu je uměle zvýšený a má připravené WIP vstupy, aby test izoloval výkon. Tyto hodnoty nejsou výchozí startovací scénář běžné hry.
