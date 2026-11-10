# Neověřené herní hodnoty

Všechny ceny, rozměry, výkony a časy katalogu jsou návrhové herní hodnoty ze zadání v0.1, nikoli průmyslový ceník nebo homologovaná technologie. Kapitál 300 mil. Kč, podíl investora 35 % bez srážky z tržeb. Výchozí pozemek 100×70 m je pouze nezakoupená plánovací mapa (bez haly či výroby). Den = 120 s při 1×, tick = 50 ms. Počáteční datum 1. 1. 2026, 00:00 UTC je herní volba.

Scénář 149 mil. stavební investice + 74 mil. technologie bez tavidla a CAB + 77 mil. rezerva je rozpočtový návrh, nikoli již utracená částka. 56 desek a 27 lamel na kus; záslepky a obal až při balení. Instalace, média a hmotnost surovin nejsou kvantifikované: null znamená doplnit před M1. Modelové náklady 1480 Kč a prodej 1850 Kč nejsou automatické transakce.

## Doplněné neověřené hodnoty M1

Pozemek 50 mil. Kč, hala 10 000 Kč/m², elektrická přípojka stroje 20 000 Kč, vzduch 10 000 Kč. Nákup stroje používá původní katalogovou cenu. Společný příkon 500 kW, koeficient aktivní energie 0.6, energie 5 Kč/kWh. Nábor 3 000 Kč, mzda 1 800 Kč/den na osobu; continuous směna je pouze zjednodušení.

Materiálové ceny (Kč/jednotka) jsou v manufacturing/catalog.ts: deska 7, lamela 9, výztuha 12, trubka 30, blok 130, záslepka 2, obal 35; pájecí svitek/plech 85 Kč/kg, pás 90 Kč/kg, trubka 80 Kč/m. Dodání 4 herní hodiny. Kooperace tavidlo+CAB 250 Kč/jádro, 2 dny. Dodatečné dopravní náklady jsou zahrnuté v ceně služby. Nezaměňovat s ověřenými nabídkami dodavatelů.

Na sadu komponent: 2.1 kg svitku → 56 desek + .1 kg odpadu; .5 kg pásu → 27 lamel + .02 kg odpadu; .15 kg plechu → 2 výztuhy + .01 kg odpadu; 1.1 m trubky → pár trubek + .1 m odřezků. Zbývající hmotnost je obsažena ve vyrobených komponentech, kusové položky nemají dosud samostatnou hmotnostní metriku. Čištění 2 l vody + .01 l čističe, test .001 m³ helia, povrch 2 l vody + .01 l chemie. Jde o návrhové veličiny pro konzistentní materiálový tok, nikoli technologický předpis.

Kvalita: 3 % testovaných jader jsou neshodné, bez automatické opravy. Opotřebení .0001/cyklus, porucha pod stavem .5 nebo se seedovanou pravděpodobností .0005/cyklus. Sada náhradních dílů 5 000 Kč, oprava 1 herní hodina a přítomnost údržbáře. Výstupní buffer 120 množstevních jednotek, vstupní 5000. Reálný přepočet kapacit na objem/hmotnost patří M2.

Expediční služba stojí 30 Kč/kus a strhává hotovost při expedici. Cena obalové sady se do této služby znovu neúčtuje.
