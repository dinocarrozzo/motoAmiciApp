# Giri di gruppo: inviti, richieste di unirsi, partecipanti, avvisi — Progetto

Data: 2026-11-28 · Stato: **da approvare** · Si appoggia su `2026-11-22-moto-app-design.md` (sezioni 3, 6, 10, 11)

## 1. Perché

Chi esce in moto vuole trovare compagnia in tempo reale. Dopo account, amici e mappa (provati sul campo) manca il centro dell'idea: **formare un gruppo e permettere a un estraneo di unirsi**. Questo passo serve anche all'emergenza, che dovrà avvisare «chi è nel giro»: l'elenco dei partecipanti nasce qui.

Storia di riferimento (dell'utente):
1. Marco decide di uscire e invita due amici con il bottone WhatsApp. Tutti e tre hanno l'app, partono ciascuno dal proprio telefono, nello stesso gruppo.
2. Sulla mappa i tre si muovono insieme.
3. Una quarta persona, premium e sconosciuta, tocca una delle tre icone: vede nickname, destinazione, tipo di uscita, elenco dei partecipanti, e manda la richiesta di unirsi.
4. I tre ricevono un avviso, anche a schermo bloccato. **Uno qualsiasi** accetta e può mandare un punto d'incontro e/o un messaggio (che può passare anche da WhatsApp, fuori dall'app).
5. Dall'accettazione la quarta persona entra nell'elenco dei partecipanti.

## 2. Obiettivi, non-obiettivi, anti-obiettivi

**Obiettivi**
- Gruppo con membri, tipo di uscita e destinazione condivisi; elenco partecipanti.
- Invito via WhatsApp (anche a chi non ha l'app) e invito in app agli amici.
- Richiesta di unirsi da chiunque veda il gruppo sulla mappa, free compresi; risposta da qualunque membro (free compresi).
- Avvisi push per richieste, risposte e inviti, anche a schermo bloccato; elenco avvisi dentro l'app.
- Regole di visibilità e di accesso decise dal server, come per la mappa.

**Non-obiettivi (questo passo)**
- Chat dentro l'app (si usa WhatsApp), tragitto o percorso condiviso, storico dei giri, espulsione di un membro (si può solo uscire), emergenza (passo successivo), acquisto dell'abbonamento, notifiche su iPhone.

**Anti-obiettivi**
- Uno sconosciuto che ottiene posizione esatta o elenco dei partecipanti senza essere accettato.
- Un utente bloccato che riesce a entrare, richiedere o vedere un gruppo dove c'è chi lo ha bloccato.
- Spam di richieste a un gruppo.
- Un avviso che dice «accettato» senza che lo sia.
- Un gruppo «fantasma» che resta sulla mappa dopo che tutti hanno finito.

## 3. Cosa vede e può fare ciascuno

| | Free | Premium |
|---|---|---|
| Vede le icone dei gruppi sulla mappa | sì | sì |
| Vede nickname di chi tocca | sì | sì |
| Vede destinazione, tipo di uscita, **elenco partecipanti** | no | sì |
| Manda richiesta di unirsi | sì | sì |
| Risponde alle richieste del proprio gruppo | sì | sì |
| Invita (WhatsApp o in app) | sì | sì |
| Riceve avvisi | sì | sì |

Posizione: gli estranei vedono i membri approssimati (500 m); **i membri dello stesso gruppo si vedono esatti**, e così chi viene accettato, da quel momento. Bloccati invisibili nei due sensi, come oggi.

## 4. Approcci considerati

- **Modo 1, il gruppo come etichetta**: ogni giro resta di una persona, con un codice di gruppo in comune. Poco lavoro, ma nessun proprietario, dati duplicati che possono divergere, entrata e uscita fragili.
- **Modo 2, il gruppo come entità con membri** (**scelto dall'utente**): un gruppo con tipo di uscita e destinazione, membri con adesione, giri legati al gruppo. Più lavoro, ma regge richieste, inviti, uscita ed emergenza.

## 5. Progetto (Modo 2)

**Modello**
- Ogni giro nasce già dentro un gruppo, anche da solo (gruppo di 1): così una richiesta ha sempre un gruppo a cui andare. *(mia scelta)*
- `ride_groups`: id, tipo di uscita, destinazione, chi l'ha creato, codice d'invito, inizio/fine. Tipo e destinazione sono del gruppo, non di ogni giro.
- `group_members`: gruppo, persona, stato (`invited`, `active`, `left`), ruolo (`owner`, `member`). **Nessun limite al numero di membri** (decisione dell'utente: giri grandi ed eventi con decine e decine di partecipanti).
- Ogni giro (`rides`) ha un `group_id`. La visibilità «Tutti / Solo amici» resta per persona.
- `join_requests`: gruppo, richiedente, stato (`pending`, `accepted`, `declined`, `cancelled`), messaggio breve, chi ha risposto, punto d'incontro (lat/lng) e nota facoltativi.
- `notifications`: destinatario, tipo (`join_request`, `join_answer`, `group_invite`), contenuto, letto/non letto. È la fonte che l'app legge; il push è solo il campanello.
- `push_tokens`: persona, token, piattaforma.

**Regole (tutte nel database, non aggirabili)**
- *Richiedere:* serve poter già vedere almeno un membro attivo del gruppo (stesse regole di `riders_in_area`: bloccati, «Solo amici»); nessun blocco in nessun verso con alcun membro attivo; non già membro; **una sola richiesta in attesa per gruppo** (nessun limite sul numero di gruppi diversi, decisione dell'utente); dopo un rifiuto, **un'ora di attesa** per riprovare sullo stesso gruppo; un tetto altissimo contro i programmi automatici (60 richieste all'ora per persona), che un utente vero non raggiunge *(mie soglie)*.
- *Rispondere:* qualunque membro attivo; **vale la prima risposta** (la seconda riceve «Richiesta già gestita»). Accettando: il richiedente diventa membro attivo (con controllo dei blocchi); il punto d'incontro e la nota arrivano a lui in un avviso.
- *Invitare:* (a) link per WhatsApp con un codice del gruppo, valido finché il gruppo è attivo; chi lo apre diventa membro attivo se non ci sono blocchi; (b) invito in app a un amico, che compare come avviso da accettare. Può invitare qualunque membro attivo.
- *Giro nel gruppo:* un membro attivo avvia il proprio giro legato al gruppo (tipo e destinazione ereditati). Chi chiude il giro esce dal gruppo; quando l'ultimo giro finisce, il gruppo termina. Se esce chi l'ha creato, il ruolo passa al membro attivo più anziano.
- *Mappa:* `riders_in_area` restituisce anche `group_id` e il numero di partecipanti; ai soli premium restituisce tipo e destinazione; ai membri dello stesso gruppo restituisce la posizione esatta. **L'elenco dei partecipanti non viaggia con la mappa** (con gruppi grandi peserebbe moltissimo): si chiede a parte quando si tocca un'icona, con una funzione riservata ai premium che lo restituisce a pagine di 50 nomi.
- *Avvisi nei gruppi grandi:* una richiesta non deve far suonare 80 telefoni. Fino a 15 membri il push arriva a tutti; oltre, arriva a chi ha creato il gruppo e ai 5 membri più anziani, mentre tutti gli altri membri la trovano comunque nell'elenco avvisi dell'app. *(mia scelta)*
- *Avvisi:* ogni evento scrive un avviso e, di conseguenza, invia un push tramite il servizio di notifiche di Expo, chiamato dal database. Quando uno risponde, gli avvisi di richiesta degli altri membri risultano risolti.

**Invito WhatsApp senza app**
- Il link è `https://www.motoamiciapp.it/invito/<codice>`. Una piccola pagina sul sito dell'utente (Tophost, caricata da lui) prova ad aprire l'app; se non c'è, propone di scaricare l'APK di prova. Con la pubblicazione sugli store la pagina passerà ai link degli store (sezione 11 del progetto principale).

**Cosa vede l'utente**
- *Scheda del motociclista:* nickname; per i premium anche uscita, destinazione, partecipanti; il bottone «Chiedi di unirti» (con un messaggio breve facoltativo); stato «richiesta inviata».
- *Pannello del giro in corso:* partecipanti, «Invita» (WhatsApp / amici), richieste da gestire con «Accetta» (con scelta del punto sulla mappa o «uso la mia posizione», più nota) e «Rifiuta».
- *Avvisi:* una voce nell'app con l'elenco; il tocco su un push apre la richiesta giusta.
- *Dopo l'accettazione:* il richiedente vede il punto d'incontro sulla mappa e il bottone «Parti con il gruppo».

## 6. Vincoli

- Android: push tramite Firebase (progetto gratuito dell'utente, chiave caricata su EAS). iPhone: non ora.
- Le notifiche push non sono garantite (risparmio batteria dei telefoni): l'elenco degli avvisi nell'app, aggiornato con la mappa ogni 10 s, è la rete di sicurezza.
- Dal container non si prova nessun push né GPS: prova su due-tre telefoni reali (l'utente ne ha due: serve un terzo account/telefono o ripetere i ruoli).
- GDPR: nessun dato nuovo oltre a quelli già trattati; i punti d'incontro sono cancellati con il gruppo dopo 24 ore *(mia scelta)*.

## 7. Lasciato al costruttore

Testi degli avvisi, grafica delle schede e del pannello, struttura precisa delle tabelle e dei permessi, periodicità dell'aggiornamento degli avvisi, gestione dei token scaduti, scelta se il push parte da un trigger del database o da una funzione di Supabase.

## 8. Cose decise da me, da controllare

Gruppo di 1 al posto di «giro senza gruppo»; **nessun limite ai membri né alle richieste in attesa (su richiesta dell'utente)**; una sola richiesta in attesa per gruppo, un'ora di attesa dopo un rifiuto, tetto di 60 richieste all'ora contro i programmi automatici; push a tutti fino a 15 membri, oltre solo al creatore e ai 5 più anziani; elenco partecipanti chiesto a parte e a pagine; la prima risposta vince; uscire dal giro = uscire dal gruppo; passaggio del ruolo di creatore; niente espulsione e niente chat in app; punto d'incontro e nota cancellati dopo 24 ore; link d'invito valido finché il gruppo è attivo e inoltrabile (chi lo riceve può girarlo ad altri: i blocchi lo contengono).

## 9. Eventi molto grandi

La mappa mostra al massimo le 100 persone più vicine al centro della zona. Per un evento con centinaia di moto nello stesso punto servirà raggrupparle (un'icona con un numero) e fare altre verifiche di carico: **non in questo passo**, ma il modello non lo impedisce. Il costo del database crescerà con gli utenti collegati contemporaneamente: da rivedere prima di un lancio grande.

## 10. Fuori da questo passo, già segnalato

Emergenza; acquisto dell'abbonamento; cancellazione dell'account; testi legali e pagine del sito; limite di richieste alla mappa; email di sistema.
