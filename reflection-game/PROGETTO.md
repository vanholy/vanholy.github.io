# reflection-game — Documento di progetto

Gioco nel browser per **misurare i tempi di reazione**, pensato soprattutto per **tablet** (comandi touch).

---

## 1. Meccanica di base

1. Dopo un'attesa **casuale** si illumina un bersaglio.
2. Chi gioca lo tocca il più in fretta possibile.
3. Il gioco registra il **tempo di reazione** in millisecondi, dall'accensione al tocco.
4. Si ripete fino al numero di interazioni impostato.

Di norma **il bersaglio non si spegne mai da solo** e resta acceso finché non viene toccato. Con l'opzione "Scomparsa bersaglio" invece si spegne dopo il tempo scelto e conta come **mancato**.

## 2. Modalità di gioco

| Modalità | Descrizione |
|---|---|
| **Bersagli visibili** | I bersagli sono sempre sullo schermo, spenti. Se ne illumina uno a caso. |
| **Bersagli che compaiono** | Lo schermo è vuoto. Un bersaglio compare in un punto casuale. |

### Survival

Si avvia dal pulsante **Survival** del menu, non dalle opzioni.

- **Difficoltà massima con tutto attivato:** bersagli visibili (8, piccoli), frequenza veloce, scomparsa del bersaglio, colori difficili, sfondo psichedelico, 20 disturbi, bersagli in leggero movimento. Suoni e musica seguono le opzioni.
- **Sempre più veloce:** a ogni bersaglio preso il tempo di scomparsa, l'attesa e la velocità dei disturbi cambiano del 4%. Si parte da 1,5 s per toccare e non si scende sotto il 30% dei tempi iniziali (minimo 0,4 s).
- **3 vite.** Si perde una vita per ogni errore (tocco in anticipo, bersaglio sbagliato, disturbo) e per ogni bersaglio mancato. Alla terza vita persa: game over.
- **Cronometro** dall'inizio della partita, fermo durante la pausa.
- **Record:** vince chi resiste più a lungo. Il record è salvato sul dispositivo e si vede nel menu. A fine partita, se lo batti, compare "Nuovo record!".
- Nella schermata di gioco si vedono tempo, vite, bersagli presi, ultimo tempo e media.

### Modalità gatto 🐱

Si avvia dal pulsante **Modalità gatto** del menu. È pensata per far giocare un gatto con il tablet.

- Al posto dei bersagli ci sono **animali**: coccinella, scarabeo, ape, topo, ragno, lucertola, farfalla e scarafaggio. Entrano dai bordi e camminano con curve casuali.
- Ce ne sono **2 alla volta** e si muovono piano (circa 30–100 px/s secondo l'animale).
- **Si fermano e ripartono**. Da fermi, topo e ape ogni tanto fanno il loro verso (squittio, ronzio).
- **Ogni tanto fanno uno scatto** per mezzo secondo, 2–4,5 volte più veloci, con un suono proprio: "zip" per insetti, ragno e lucertola, squittio per il topo, ronzio per l'ape, frullio d'ali per la farfalla. Durante lo scatto zampe, ali e coda vanno più veloci.
- **Mentre camminano fanno rumore**, diverso per ogni animale: zampette che grattano, ticchettio del ragno, passettini del topo, strusciare della lucertola, frullio della farfalla, ronzio dell'ape. Il suono arriva dal lato dello schermo in cui si trovano. Questi rumori sono sempre attivi, indipendentemente dall'opzione Suoni.
- Basta toccare **vicino** all'insetto, perché una zampa è grossa. L'insetto schiacciato sparisce con una macchia e un suono, e dopo 1–2 s ne entra un altro.
- **Sfondo:** se nelle opzioni è scelto "La tua foto", gli animali camminano sulla foto; altrimenti sul prato scuro.
- **Nessun timer:** solo un contatore grande degli insetti presi.
- **Per uscire bisogna tenere premuto** il pulsante in alto a destra per 1,2 s, così il gatto non esce per sbaglio.

### Animazione di apertura

All'avvio, per 3 secondi, prima della home: sfondo psichedelico, bersagli che si accendono a raffica con l'anello del tocco, forme di disturbo e insetti che attraversano lo schermo, la barra del tempo di reazione che corre e si ferma su un tempo, e infine il titolo che arriva in primo piano. Poi si dissolve nella home. Un tocco la salta. Con "riduci movimento" attivo sul dispositivo compare solo il titolo.

## 3. Schermata di gioco

- **Bersagli** rotondi, grandi come una moneta (dimensione regolabile).
- **Barra del tempo di reazione** in basso: parte da zero quando il bersaglio si accende e si allunga mentre il tempo passa. Dopo il tocco resta ferma sul tempo fatto e si azzera all'accensione successiva. Con la scomparsa attiva è piena quando il tempo scade.
- **Contatore delle interazioni**, per esempio `7 / 20`. Conta i bersagli toccati più quelli mancati.
- **Ultimo tempo di reazione**, per esempio `312 ms`.
- **Media** di tutte le reazioni della partita fino a quel momento.
- **Errori** e, se la scomparsa è attiva, **Mancati**.
- **Elementi di disturbo** (opzionali): forme non rotonde (quadrati, triangoli, stelle, rombi, esagoni, croci) che si muovono e rimbalzano sullo schermo.

## 4. Opzioni

| Opzione | Valori |
|---|---|
| Livello | Base / Medio / Avanzato / Personalizzato: imposta tutte le opzioni insieme |
| Modalità | Bersagli visibili / Bersagli che compaiono |
| Dimensione bersagli | Piccola (48 px) / Media (72 px) / Grande (100 px) |
| Numero di bersagli | 3 / 5 / 8 / 12 (solo nella modalità "Bersagli visibili") |
| Frequenza | Lenta / Media / Veloce: è l'intervallo di attesa prima dell'accensione, che resta **sempre casuale** |
| Scomparsa bersaglio | Mai / 3 s / 2 s / 1,5 s / 1 s |
| Colori bersaglio | Fissi (giallo) / Variabili (colore casuale, sempre ben visibile) / Variabili difficili (colore vicino allo sfondo, senza alone; metà dei disturbi prende lo stesso colore) |
| Sfondo | Fisso / Cambia ogni volta (nuovo colore a ogni attesa) / Psichedelico (animato: spirali e cerchi che ruotano e cambiano colore lentamente, senza lampeggi) / La tua foto (una foto scelta dal telefono o scattata al momento, adattata allo schermo; si cambia con "Scegli foto") |
| Bersagli in movimento | No / Leggero (30 px/s) / Veloce (70 px/s): i bersagli scivolano in una direzione casuale e rimbalzano sui bordi, anche quello acceso |
| Elementi di disturbo | Nessuno / 3 / 7 / 12 / 20 |
| Musica | No / Arcade (arpeggio, 112 bpm) / Techno (cassa dritta e basso acido, 128 bpm) / Ipnotica (tappeto lento, campanelle con eco, 70 bpm). Toccando una musica nelle opzioni si sente un'anteprima di 5 s |
| Suoni | No / Sì: tocco riuscito, errore, mancato, fine partita, nello stile della musica scelta (Arcade se la musica è spenta). Nessun suono all'accensione, così il test resta solo visivo |
| Numero di interazioni | 10 / 20 / 30 / 50 |

Suoni, musica e numero di interazioni non fanno parte dei livelli.

Attesa casuale prima dell'accensione:
- **Lenta:** 2–5 s
- **Media:** 1–3 s
- **Veloce:** 0,5–1,5 s

### Livelli

Il numero di interazioni non cambia col livello. Toccare una qualsiasi altra opzione passa a "Personalizzato".

| | Base | Medio | Avanzato |
|---|---|---|---|
| Modalità | Visibili, 5 bersagli | Compaiono | Visibili, 8 bersagli |
| Dimensione | Grande | Media | Piccola |
| Frequenza | Lenta | Media | Veloce |
| Scomparsa | Mai | 2 s | 1 s |
| Colori | Fissi | Variabili | Variabili difficili |
| Sfondo | Fisso | Fisso | Cambia ogni volta |
| Disturbi | Nessuno | 3 | 12 |
| Bersagli in movimento | No | No | Leggero |

## 5. Errori

- **Tocco in anticipo** (prima che si accenda qualcosa): conta come errore.
- **Tocco sul bersaglio sbagliato** o fuori dal bersaglio: conta come errore. Il bersaglio acceso resta acceso.
- **Tocco su un elemento di disturbo:** conta come errore.
- **Bersaglio mancato** (scaduto il tempo di scomparsa): si conta tra i "mancati", non tra gli errori.
- **Tocco subito dopo un mancato** (entro 1 s): compare "Troppo tardi!" e non conta come errore, perché è già contato tra i mancati.
- Errori e mancati si contano a parte e non influiscono sul calcolo dei tempi.

## 6. Fine partita e statistiche

A fine partita si vede un riepilogo:
- tempo medio, migliore e peggiore
- numero di errori e di mancati
- grafico dell'andamento dei tempi durante la partita

## 7. Storico

- Ogni partita viene salvata in **localStorage** sul dispositivo, con data, impostazioni, tutti i tempi ed errori.
- Una schermata "Storico" mostra le partite passate e l'andamento della media nel tempo. Le partite survival mostrano il tempo resistito.
- La foto di sfondo è ridotta (lato massimo 1600 px, JPEG) e salvata anche lei sul dispositivo; non viene mai caricata in rete.
- Il record survival è salvato a parte. "Cancella storico" cancella anche il record.

## 8. Giocatori

Nella home si sceglie **👤 Un giocatore / 👥 Due giocatori**; poi "Gioco normale" e "Survival a tempo" partono nella modalità scelta. In due vale per le partite normali (tutti i livelli) e per la Survival, non per la modalità gatto.

- **Schermo diviso lungo il lato corto:** in orizzontale metà sinistra e destra, in verticale metà sopra e sotto. Ogni giocatore siede sul lato corto della sua metà e il suo campo è girato verso di lui: la barra del tempo è dal suo lato, i punteggi verso il centro.
- Ogni giocatore ha **bersagli, attese, disturbi, barra e statistiche indipendenti**, con le stesse impostazioni. Si gioca in contemporanea.
- **Punti:** bersaglio preso = 1000 − tempo di reazione in ms (minimo 100, massimo 1000); errore −200; mancato −100.
- **Partita normale:** chi finisce le interazioni aspetta l'avversario. Vince chi ha più punti, a parità è pareggio.
- **Survival in due:** ognuno ha 3 vite e accelera in base ai propri bersagli presi. Appena uno perde l'ultima vita la partita finisce per tutti e vince l'altro. Il record survival vale solo per le partite da soli.
- A fine partita ognuno vede nella sua metà "Hai vinto! 🏆", "Hai perso" o "Pareggio!". Poi la schermata dei risultati mostra una riga per giocatore e il grafico dei tempi di entrambi (G1 verde, G2 rosa).
- Nello storico le sfide compaiono come "In due" con i punti, il vincitore, gli errori e i mancati di G1 / G2.

## 9. Tecnologia

- HTML, CSS e JavaScript puri, senza installazioni. Funziona offline una volta caricato.
- Pubblicazione su GitHub Pages, nella cartella `reflection-game/` del repository `vanholy.github.io`: https://vanholy.com/reflection-game/
- Tempi misurati con `performance.now()` ed eventi `pointerdown`, per la massima precisione al tocco.
- Suoni e musica generati con Web Audio, senza file audio da scaricare.
