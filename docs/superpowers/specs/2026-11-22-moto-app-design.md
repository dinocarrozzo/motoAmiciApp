# App per motociclisti (nome di lavoro: "MotoAmici") — Progetto

Data: 2026-11-22 · Stato: **approvato dall'utente il 2026-11-22**

> Nota: questo repository contiene già un'altra app ("Registra Contatti", Android nativo). Non c'entra con questa. Il codice della nuova app va in un **repository nuovo e dedicato** (scelta dell'utente), da creare prima di iniziare a scrivere codice.

## 1. Scopo

Un'app per iPhone e Android, venduta ad abbonamento, che permette ai motociclisti di **trovarsi e organizzare uscite insieme**. Chi è in giro condivide la posizione GPS in tempo reale e compare su una mappa; gli altri possono vedere chi c'è, che giro sta facendo e chiedere di unirsi. Un tasto di emergenza avvisa chi è nel giro o un contatto fidato.

Perché: oggi i motociclisti si organizzano con gruppi WhatsApp e passaparola. Chi vuole uscire e non ha compagnia non ha modo di trovarne in tempo reale.

## 2. Obiettivi, non-obiettivi, anti-obiettivi

**Obiettivi**
- Posizione in tempo reale affidabile anche a schermo bloccato per ore.
- Mappa con segnaposto di chi sta condividendo, con i dati del giro.
- Richieste di unirsi al giro e inviti (in app e via WhatsApp).
- Tasto di emergenza sempre disponibile, anche nel livello free.
- Modello free + premium con abbonamento su App Store e Play Store.

**Non-obiettivi (per la prima versione)**
- Navigazione turn-by-turn.
- Registrazione e storico dei percorsi, statistiche, classifiche.
- Social network (feed, foto, commenti).
- Chiamata automatica ai soccorsi.

**Anti-obiettivi (sarebbe un fallimento anche se "funziona")**
- Un utente che viene seguito o rintracciato da uno sconosciuto.
- L'app che smette di tracciare in background senza che l'utente se ne accorga.
- Promettere ai motociclisti un soccorso che l'app non può garantire.
- Batteria scarica a metà giro a causa dell'app.

## 3. Cosa fa l'app (decisioni dell'utente)

**Condivisione della posizione**
- Prima di partire si imposta chi vede il giro: **"Tutti i motociclisti dell'app"** (default, scelta dell'utente) oppure **"Solo amici"**. La scelta vale per l'uscita.
- Si possono **bloccare utenti**: non vedono mai la persona sulla mappa, qualunque impostazione, senza ricevere notifiche.
- La condivisione si ferma a fine giro.
- Alla prima attivazione, schermata di consenso chiara: "La tua posizione sarà visibile a tutti i motociclisti mentre sei in giro", con tasto per cambiare.
- Chi non è amico vede la posizione **approssimata (circa 500 m)**; quella esatta la vedono gli amici e chi ha accettato la richiesta di unirsi al giro. In emergenza la posizione esatta va a tutti i destinatari dell'allarme. (Approvato dall'utente.)

**Dati del giro** (uguali per tutti gli utenti, free e premium, nell'inserimento)
- Tipo di uscita: passeggiata, passeggiata veloce, enduro.
- Tipo di moto: stradale sportiva, custom, naked, enduro, maxienduro.
- Destinazione e percorso, se indicati alla partenza.
- Nickname e sesso (facoltativo).

**Mappa**
- Segnaposto per colore: azzurro uomo, rosa donna, viola per chi non indica il sesso.
- Piccolo tag sugli amici.
- Il nickname lo vedono tutti, anche i free (serve a riconoscere gli amici).

**Livelli**

| | Free | Premium |
|---|---|---|
| Farsi vedere sulla mappa | sì | sì |
| Vedere gli altri sulla mappa, con nickname e colore | sì | sì |
| Dati di giro, moto, percorso degli altri | no (solo puntino) | sì |
| Richiesta di unirsi a un giro | sì | sì |
| Invito su WhatsApp | sì | sì |
| Filtri di ricerca | no | sì |
| Emergenza | sì | sì |

Gli inviti su WhatsApp sono aperti ai free perché fanno conoscere l'app. Funzionano così: l'app apre WhatsApp con un testo pronto e il link per scaricarla; l'invio lo fa l'utente.

**Emergenza**
- Tasto protetto da pressioni accidentali (tenuto premuto 3 secondi, conto alla rovescia annullabile).
- Manda un allarme con posizione esatta, nome e moto a chi condivide il giro e al contatto fidato scelto in anticipo.
- Il contatto fidato di solito non ha l'app: l'allarme parte dal server come SMS (servizio a pagamento, pochi centesimi per allarme).
- Offre anche "Chiama 112" in un tocco. Il testo dell'app non promette l'intervento dei soccorsi.

## 4. Approcci considerati

| | Come | Esito |
|---|---|---|
| **A** | React Native (Expo) + Supabase (database con ricerca per vicinanza e regole di accesso per riga) | **Scelto** |
| B | Flutter + Firebase | Scartato: le regole di privacy vanno in funzioni separate e i costi crescono con gli utenti collegati |
| C | Due app native (Swift, Kotlin) | Scartato: costo doppio, vantaggio sul GPS recuperabile con una libreria specializzata |

Scelta di A motivata da: un'unica app per i due store, regole di blocco/approssimazione/livello decise dal server (non aggirabili), costi prevedibili.

**GPS:** per il tracciamento in background si usa una libreria nativa specializzata (react-native-background-geolocation o equivalente), non il solo modulo base di Expo. Il tracciamento è la parte più rischiosa e si costruisce e valida per prima (vedi sezione 6).

## 5. Vincoli

- Posizione in background: richiede il permesso "Sempre" su iPhone e il servizio in primo piano con notifica fissa su Android; Apple e Google chiedono una motivazione chiara in revisione.
- Android Samsung e Xiaomi chiudono le app in background: serve una schermata iniziale che guida l'utente a disattivare il risparmio batteria per l'app.
- Account sviluppatore: Apple 99 $/anno, Google 25 $ una tantum.
- Abbonamenti tramite gli acquisti in-app degli store (commissione 15-30%); RevenueCat per gestire entrambi.
- GDPR: la posizione è un dato personale sensibile nei fatti. Servono informativa, consenso, cancellazione dell'account e dei dati, conservazione minima dei punti GPS.
- Dal container in cloud non si può provare il GPS su un telefono: i test sul campo si fanno su telefoni reali (utente: Android Samsung e Xiaomi). Non c'è un iPhone di test al momento.

## 6. Ordine di lavoro proposto

1. **Prototipo GPS usa-e-getta**: traccia in background su Samsung e Xiaomi durante un giro vero e manda i punti al server. Si decide se la strada regge prima di andare avanti.
2. Account, profilo (nickname, sesso, moto), amici e blocchi.
3. Mappa in tempo reale con le regole di visibilità e di approssimazione.
4. Giri: creazione, richieste di unirsi, inviti WhatsApp.
5. Emergenza (con SMS dal server).
6. Livelli free/premium, abbonamenti, filtri di ricerca.
7. Pubblicazione sugli store (informative, schede, revisione).

## 6b. Prova gratuita

La prova non addebita nulla e non richiede un metodo di pagamento: alla scadenza l'account torna free. Per questo non è la "prova gratuita" integrata negli store (che poi si rinnova a pagamento), ma un periodo premium concesso dal server: una sola volta per account, con scadenza memorizzata sul server e controllata dalle regole di accesso. Va verificato che la formulazione sia conforme alle regole di Apple e Google.

## 7. Lasciato al costruttore

Scelta del servizio mappe (Mapbox, Google Maps o MapLibre), frequenza di campionamento del GPS e risparmio batteria, struttura del database, servizio SMS (Twilio o simile), schermate e grafica, lingue (partire dall'italiano).

## 8. Cose decise da me, da controllare

- Nome di lavoro "MotoAmici" (l'utente ha proposto "Amici in moto" o "MotoAmici"): più corto e più facile da ricordare; "Amici in moto" può restare come sottotitolo negli store. Da verificare la disponibilità del nome sugli store e come marchio prima della pubblicazione.
- Il nickname è visibile di tutti, non solo degli amici.
- Le chat e i messaggi di gruppo del giro sono premium; il free manda solo la richiesta con un breve testo. (Proposta mai confermata dall'utente.)
- Chi riceve una richiesta può sempre rispondere, free o premium.
- Partenza e arrivo nascondibili in un raggio dalla propria casa.
- Prima versione solo in italiano.
- Età minima 18 anni.

## 9. Decisioni prese e domande aperte

**Decise dall'utente**
- Prezzo abbonamento: **9,90 € al mese, 59 € all'anno** (l'annuale costa circa il 50% in meno di 12 mesi pagati uno a uno). Sono prezzi al pubblico: comprendono l'IVA e gli store trattengono il 15-30%, quindi l'incasso netto è sensibilmente più basso (stima: circa 6,9 € al mese col 15% di commissione).
- Prova gratuita: **14 giorni di premium, poi si torna automaticamente al piano free**, senza addebiti.
- Nome: tra "Amici in moto" e "MotoAmici" (vedi sezione 8).
- Repository nuovo e dedicato.

**Ancora aperte**
- Disponibilità del nome sugli store prima di fissarlo.

## 10. Aggiornamenti del 2026-11-25 (account, ricerca, avatar)

Decisioni dell'utente:
- **Accesso:** email e password (min. 8 caratteri), recupero password via email. Conferma email spenta in sviluppo, da riaccendere prima della pubblicazione con un servizio di invio email.
- **Profilo:** nickname (unico), nome facoltativo, sesso facoltativo, avatar, tipo di moto, contatto fidato per l'emergenza (visibile solo al proprietario).
- **Ricerca amici:** barra di ricerca con suggerimenti mentre si digita, per nickname o nome (da 2 caratteri, max 10 risultati, solo dati pubblici del profilo). Obiettivo: favorire la socializzazione. Amicizia con richiesta e accettazione; blocco invisibile nei due sensi.
- **Avatar:** scelto alla registrazione da un catalogo di immagini simpatiche (inizialmente emoji, nessun caricamento di foto).
- **Codice del prototipo:** resta come base dell'app vera (coda punti, tracciamento, procedura permessi); cambia la schermata di prova.

Da decidere nel pezzo sulla mappa: segnaposto = moto del colore del sesso (proposta, uguale per tutti, perché una forma per tipo di moto rivelerebbe ai free un dato premium) con l'avatar nelle schede, oppure l'avatar sulla mappa.

Correzioni dopo la prima prova sui telefoni (2026-11-25):
- **Sesso e tipo di moto obbligatori** alla registrazione e per proseguire (nessuna scelta preimpostata). «Preferisco non dirlo» resta una scelta valida per il sesso (segnaposto viola). Chi ha un account senza tipo di moto viene fermato su «Completa il profilo» finché non lo indica.
- **Blocco reversibile**: bloccare nasconde amicizie e richieste, sbloccare le ripristina (prima le cancellava).

## 10. Mappa in tempo reale (aggiunta 2026-11-27)

Decisioni dell'utente: per vedere gli altri non serve condividere la propria posizione; la mappa riceve le posizioni degli altri solo quando è aperta (ogni ~10 s), mentre la propria condivisione continua in background; mappa gratuita (MapLibre + OpenFreeMap), con passaggio a Google se non idonea.

Regole decise dal server: non amici in posizione approssimata (cella ~500 m), amici esatta; bloccati invisibili nei due sensi; «Solo amici» visto solo dagli amici; tipo di uscita, moto e destinazione solo ai premium; sparisce chi non aggiorna da 2 minuti o preme Ferma. Piano: `docs/superpowers/plans/2026-11-27-mappa-tempo-reale.md`.

## 11. Link di invito che apre l'app o lo store (nota dell'utente, 2026-11-27)

Oggi l'invito WhatsApp contiene solo il testo (`APP_DOWNLOAD_LINK` è vuoto). Voluto: un unico link di invito che, toccato, **apre l'app se è installata, altrimenti porta allo store**.
Come: pagina web su un dominio nostro (es. `…/invito/<codice>`) + collegamenti universali (Android App Links con `assetlinks.json`, iOS Universal Links con `apple-app-site-association`) + `intent-filter` nell'app; la pagina, se l'app non c'è, rimanda a Play Store / App Store. Facoltativo: dopo l'installazione, riaprire sull'invito (deferred deep link).
Richiede: un dominio, le schede sugli store (quindi l'app pubblicata) e un account sviluppatore Apple per iPhone. Fino alla pubblicazione la pagina può offrire il download dell'APK.
