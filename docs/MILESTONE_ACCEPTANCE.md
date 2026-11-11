# Akceptace M0–M6 — verze 0.6.0

Milníky jsou implementované jako funkční výchozí verze, nikoli jako tvrzení o neomezeném průmyslovém simulátoru. Zjednodušení níže jsou konkrétní pravidla hry; budoucí vylepšení nejsou označená za existující funkce.

| Milník | Skutečné funkce                                                                                                                                                                         | Důkaz                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| M0     | WebGL mapa, kamera, oddělené headless jádro, fixed-step, save/load                                                                                                                      | core.test.ts + browser smoke                              |
| M1     | Pozemek/hala/stroje, materiál, energie, logistika, výroba FE-HX001, kooperace, kvalita, expedice a splatnost                                                                            | production.test.ts: T01–T10 + celá zakázka                |
| M2     | Zóny/pozice, kg/m³, kontejnery a dávky, FIFO, rezervace a dělené přepravy, VZV a šířka cesty, sdílené trasy, příjem z ramp a časové sloty                                               | enterprise.test.ts M2 + browser přehled + campaign        |
| M3     | Seedovaný trh, nabídky, výrobní příkazy, MRP, obchodní rezervace, uvolnění nákupu, rámcové smlouvy do 36 měsíců, odvolávky, sankce, termíny/kapacity a cash flow                        | enterprise.test.ts M3 + campaign                          |
| M4     | Profese, směny včetně noční, týmy střídajících se operátorů, kvalifikace, školení, absence, servisní kalendář, díly a automatické plánování, poruchy podle stavu, MTTR                  | enterprise.test.ts M4 + production repair test + campaign |
| M5     | Vlastní tavidlo/CAB 36 ks/h, zdroje a trasy médií, souběžná kapacita, voda/dusík/odsávání, reálné zásoby médií v receptu, odpad a karanténa, genealogie šarží a výsledky 100% testování | enterprise.test.ts M5 + campaign od suroviny po inkaso    |
| M6     | Výzkum s cenou a dobou, robotizace pracoviště, dopravníky, AGV se skutečnými rezervacemi, MES doplňování a OEE, exportní varianta výrobku s vlastním balicím BOM                        | enterprise.test.ts M6 + campaign + browser přehled        |

## Co testy nedokazují

Nejde o garanci FPS na každém hardwaru, reálný technologický předpis ani účetní certifikaci. Headless benchmark používá 144 fyzicky rozmístěných balicích stanic, 200 pracovníků a 5000 šarží, připravené vstupy a zvýšený scénářový rozpočet/příkon (nemění start nové hry). Simuluje 200 ticků / 2 herní hodiny; jsou skutečné výrobní dokončení i přepravy. Nejde o benchmark celého výrobního mixu nebo tří let nepřetržitého provozu. Výsledky aktuálního běhu jsou artifacts/performance.json.

Browser smoke testy ověřují skutečné příkazy a perzistenci UI, nikoli každý možný výrobní layout. Plný výrobní scénář používá stejné jádro headless. Browser testy běží v systémovém Chromiu se softwarovým WebGL.

## Modelové hranice

- Mapa 100×70 m a jedna obdélníková hala; bez navazujícího nákupu nových parcel. Skladová zóna reprezentuje soubor regálových pozic jedním fyzickým obdélníkem, nikoli jednotlivé police. Centrální původní příjem má kompatibilní limit množství; nové zóny mají kg/m³.
- Dopravní rezervace zamyká celou sdílenou trasu po dobu jízdy, což bezpečně brání protijízdě, ale je konzervativnější než rezervace každého segmentu v čase. Jedna úloha zahrnuje cestu z domovského bodu k vyzvednutí, do cíle a zpět; převod šarže je atomický při dokončení úlohy. VZV používá širší cestu, AGV samostatný zdroj, dopravník pevnou trasu. Doba mimo závod je fronta dodávky/kooperace.
- Rozvody jsou samostatné zdroje a trasy se souběžnou kapacitou. Nesimulují hydraulické tlakové ztráty ani teplotní křivku pece. Početní parametry jsou herní. Původní M1 power/air přípojka zůstává kompatibilní; vlastní CAB/tavidlo vyžadují příslušná média, detailní vynucení všech dokončovacích médií je přepínač režimu.
- MRP je deterministický materiálový rozpad z BOM a zvolené make/buy trasy, nikoli optimalizační APS řešič. Výrobní plán rezervuje existující materiál do uvolnění, potom fyzické rezervace přebírají stroje/logistika. Stroje je nutné umístit, přiřadit a zvolit recept; plán je nepostaví ani nezmění automaticky lisovací nástroj.
- Rámcové odvolávky mají měsíční periodu 30 herních dnů a nejvýše 36 měsíců. Sankce jsou 0,5 % ceny za celý den zpoždění; pozdní expedice zůstává možná. Není simulována inflace, úvěry ani konkurence.
- Výchozí operator zachovává široké kvalifikace M1; specializované nové profese mají omezené dovednosti. Školení přidává konkrétní kvalifikaci, absence plánuje hráč. Nejsou náhodně generované nemoci. Servis je zjednodušen na sadu dílů a hodinovou práci, nikoli rozpad na stovky mechanických komponent.
- Robotizace nahrazuje personální podmínku existujícího stroje, stále vyžaduje materiál, média a kapacitu. AGV/dopravník mají energetický náklad na úlohu, bez podrobného bateriového modelu. Výzkum odemyká provozní funkce, nedává peníze ani výrobky.
- FE-HX001-P je **tentýž fyzický výparník v exportním ochranném balení**, s dvojitou obalovou sadou, jiným balicím taktem a cenou. Není to smyšlená homologovaná termodynamická konstrukce druhého výparníku.
- OEE používá zvlášť dostupnost × výkon × kvalitu. Plánovaný čas je zaznamenaný aktivní provoz bez vypnutého/mimosměnového idle; metriky jsou herní agregace, nikoli certifikovaný MES sběr. Účetní denní report drží posledních 366 dní, finanční pohyby posledních 200 položek.
- Ruční uložení a JSON záloha zůstávají nutné; neexistuje PWA cache, offline výrobní dohánění ani cloudový účet. Schéma v3 má explicitní maximální počty entit a odmítá neplatné vazby. Dlouholeté neomezené archivy nepatří do této verze.

Fronta manipulace má limit 5000 úloh; při naplnění zůstane další materiál fyzicky v bufferu. Denní kompakce genealogie drží úplné předky živých šarží, posledních 1000 inspekcí a nedávné události. Uzavřené staré větve se odstraňují; pokud živý archiv přesáhne 90000 záznamů, nová výroba se blokuje místo vytvoření neuložitelného stavu. Import má limit 128 MiB.
