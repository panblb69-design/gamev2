# Architektura M0

TypeScript strict + Vite; PixiJS 8 WebGL přes rozhraní FactoryRenderer. HTML panely, české texty v ui/text.ts. Bez backendu, fontů a vzdálených runtime služeb.

Core neimportuje DOM ani renderer. Simulation vlastní serializovatelný stav, integer tick a seed PRNG. Clock přijímá reálné milisekundy a vydává kroky 50 ms; 120 s = herní den. Pauza/1/2/5/10. Při skrytí okna se hodiny zastaví: žádná neomezená offline smyčka. Omezený frame delta chrání hlavní vlákno při návratu z přetížení; zahazuje se reálný čas, nikoli jednotlivé simulační kroky.

Renderer má vlastní RAF, kameru a statickou grid geometrii (jedna batched Graphics, nikoli objekt na políčko). Výběr používá přímý převod souřadnic O(1). UI se obnovuje maximálně 4×/s, hodnoty pouze při změně. M0 neprochází prázdné budoucí entity každý tick.

## Rozšíření M1+

Normalizované instance s ID odkazují na neměnné katalogy. Manufacturing plánuje dokončení cyklů do prioritní fronty; inventory pracuje se šaržemi/kontejnery a rezervacemi, ne s jednotlivými kusy. Logistics vlastní úlohy, workforce dostupnost a směny. World/grid spravuje obsazenost a revizi průchodnosti; cache cest klíčovaná revizí, lokální invalidace. Utilities přepočítává síť pouze po změně. Dynamické sprites budou poolované a aktualizované odděleně od statické mapy. UI posílá příkazy core, nikoli přímé ekonomické změny. Command ID zajistí idempotentní nákupy.

Cíl: stovky strojů, 100–200 lidí a tisíce kontejnerů. M0 pro tuto zátěž ještě nemá výrobní systémy, proto tento cíl nelze označit za změřený. Panel uvádí skutečné FPS, délku ticku a skutečné počty entit/úloh.

Save: IndexedDB transakce, verzovaná obálka, runtime validace, čistá migrace starších formátů; JSON export/import. Chybný import nikdy nenahradí aktivní svět. PRNG stav je součástí save. Kamera a rozpracovaný podkrok hodin jsou stav prezentace a neukládají se; načítání začíná na hranici ticku. Aktuální formát v1 nemá starší migraci; neznámé verze se odmítnou.
