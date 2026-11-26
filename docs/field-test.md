# Prova sul campo del prototipo GPS

Obiettivo: capire se il GPS in background regge per ore su Samsung e Xiaomi.

## Prima di partire (una volta)
1. Configura Supabase: `docs/setup-supabase.md`.
2. Crea un account Expo gratuito, poi dalla cartella del progetto: `npx eas-cli login` e
   `npx eas-cli build --platform android --profile development`. Scarica l'APK dal link finale e installalo sul telefono.
   (Le variabili `EXPO_PUBLIC_SUPABASE_*` vanno impostate anche per EAS: `npx eas-cli env:create`.)
3. Telefono carico al **90% o più**.

## Il giro (una prova per ogni telefono)
1. Apri l'app: segui la guida al risparmio batteria della tua marca e poi tocca "Ho fatto, continua".
2. Tocca **Avvia** e concedi "Consenti sempre" alla posizione. Se compare un avviso rosso, risolvilo prima di partire.
3. **Annota** la percentuale di batteria e l'ora di partenza.
4. Blocca lo schermo, metti il telefono in tasca o sul supporto e fai un giro di **almeno 2 ore**.
5. Alla fine riapri l'app: annota la batteria, i "punti inviati" e i "punti in attesa", poi tocca **Ferma**.
6. Copia l'identificativo della sessione mostrato nell'app.

## Il referto
```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/analyze-session.ts <sessione> --battery-start 90 --battery-end 74 --hours 2
```

## Criteri di successo (proposti, da confermare)
- Nessun buco superiore a 120 s in movimento, salvo zone senza copertura documentate.
- Almeno il 95% degli intervalli tra due punti entro 15 s.
- Consumo di batteria non oltre l'8% all'ora.

Il referto mostra buco massimo, buchi oltre i 120 s e consumo orario. L'intervallo mediano è un indicatore, il 95% va stimato guardando che il mediano sia ben sotto i 15 s.
Se i criteri non sono rispettati: si prova la configurazione (frequenza, filtro di distanza), poi il fallback `expo-location` o il tracciamento nativo per quella parte.

## Nota per le sessioni Claude (container cloud)
La chiave Supabase è salvata come credenziale di rete: nello script si usa il segnaposto `proxy-injected` e il proxy mette la chiave vera. Node deve passare dal proxy:
```
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
SUPABASE_URL=https://uqymtqlcotuhudshwszf.supabase.co SUPABASE_SERVICE_ROLE_KEY=proxy-injected \
npx tsx scripts/analyze-session.ts <sessione> --battery-start N --battery-end N --hours N
```

## Risultati finora
- Motore gratuito (expo-location), prova di 34 min, precisione massima, un punto ogni 5 s: in movimento 98% degli intervalli entro 15 s, buco massimo 15 s; consumo ~22,6 %/h (schermo in parte acceso, quindi non confrontabile col limite dell'8 %/h).
- Profilo attuale (scelto dall'utente per ridurre la batteria): precisione alta, un punto ogni 10 s, filtro 10 m. Con questo ritmo il criterio «95% degli intervalli ≤ 15 s» va letto sui soli intervalli in movimento.
- Prova lunga a due telefoni (23/11): sessione `549958e0` (97 min, 307 punti, tutti inviati, Ferma ok, buchi > 2 min solo da fermo o quasi) e sessione `11ba470e` (Samsung, 65 min di punti poi nulla per 75 min, con l'app che mostrava «sta tracciando», numeri fermi e Ferma che non rispondeva). Causa più probabile: un invio di rete appeso senza fine bloccava la coda dei punti. Corretto con: tempo massimo agli invii (15 s per la richiesta, 20 s per il buffer), coda che non aspetta la rete, Ferma che ferma subito il GPS. Da riverificare sul campo.
- Xiaomi, sessione `549958e0` (97 min, profilo alta precisione / 10 s / 10 m, schermo prevalentemente spento): uso batteria dell'app 4,01% (dato di sistema, app usata solo per questa prova) ⇒ al massimo ~2,5 %/h, sotto il limite dell'8 %/h. Tracciamento continuo, 307/307 punti inviati.
- Rimossa del tutto la libreria a pagamento (Transistorsoft): all'avvio mostrava «license validation failure» anche col motore gratuito. Resta nella storia di git se servisse. L'esclusione dal risparmio batteria ora apre la finestra di sistema (expo-intent-launcher); Android non permette di sapere se l'utente ha accettato, quindi si ricorda solo che è passato dalla finestra.
- Rischio per la pubblicazione: Google Play limita l'uso del permesso REQUEST_IGNORE_BATTERY_OPTIMIZATIONS a certe categorie di app. Da verificare con la scheda dello store prima di pubblicare.
- Samsung, sessione `5326d4aa` (112 min, versione con coda non bloccante e Ferma corretto): 451 punti sul server = 451 inviati nell'app, 0 in attesa; in movimento 93% degli intervalli ≤ 15 s e buco massimo 38 s; i buchi lunghi (9,8 min iniziali, 3,7 min, 2,8 min) iniziano da fermo o quasi fermo. Nessuno stallo, Ferma funziona. Batteria: 37% alle 16:14 → 15% alle 17:36 (circa 16 %/h su 82 min) ma non isolata dal resto (schermo acceso? altre app?): da misurare con «Utilizzo batteria» del telefono.

## Account e amici (prova su due telefoni)
Serve la build con gli account. Due utenti: A su un telefono, B sull'altro.
1. **Registrazione**: A si registra (email, password di almeno 8 caratteri, nickname, avatar, spunte 18+ e informativa). Poi la procedura dei permessi. Controlla: se la registrazione va a buon fine entri direttamente nell'app.
2. **Nickname già preso**: B prova a registrarsi con lo stesso nickname di A (anche con maiuscole diverse): deve comparire «Completa il profilo» con il messaggio, non un blocco.
3. **Ricerca**: A scrive 2 lettere del nickname di B nella scheda Amici: B deve comparire mentre si scrive. Con una lettera sola non cerca.
4. **Amicizia**: A tocca «Aggiungi» su B. B vede la richiesta nella scheda Richieste e tocca «Accetta»: entrambi si trovano tra gli Amici.
5. **Blocco**: A blocca B (conferma). B non trova più A nella ricerca e A non trova B; A vede B in «Bloccati»; B non vede nessun avviso. A sblocca: tornano a trovarsi **e, se erano amici, l'amicizia ricompare** (anche per B).
6. **Contatto fidato**: nel Profilo di A inserisci nome e numero (anche scritto con spazi): salvato in formato +39…; poi svuota i due campi e salva: il contatto viene rimosso.
7. **Esci e rientra**: Profilo → «Esci dall'account», poi accedi di nuovo. Password sbagliata → «Credenziali non valide».
8. **Recupero password**: dalla schermata di accesso «Password dimenticata?» → email → tocca il link dal telefono: l'app si apre su «Scegli una nuova password». Attenzione: il servizio email gratuito invia al massimo 2 messaggi l'ora.
9. **Tracciamento con l'account**: Avvia un giro di qualche minuto, poi Ferma: i punti arrivano (stesso referto di prima).
10. **Sessione lunga** (da fare quando capita): tracciare per più di 1 ora con l'account attivo; dopo il referto non devono esserci buchi per scadenza della sessione.

- Prima prova su Xiaomi (25/11): registrazione con email o nickname già usati → errore chiaro; ricerca con suggerimenti, richiesta, blocco: ok. Trovati due difetti, corretti: (1) sesso e tipo di moto non erano obbligatori; (2) sbloccando un amico spariva dall'elenco (il blocco cancellava l'amicizia). Il passo 1 della prova diventa: **non si può proseguire senza scegliere sesso e moto**, e gli account già creati senza moto vedono «Completa il profilo».
- Segnalazione dell'utente (25/11): la barra delle schede in basso era in parte coperta dai tasti di navigazione di Android (l'app disegna fino in fondo allo schermo). Corretto lasciando libero lo spazio dei tasti del telefono (react-native-safe-area-context). Da controllare sul telefono, con i tasti a tre pulsanti e con i gesti.
- Prova del 26/11: tutto superato tranne un difetto: quando il destinatario accettava una richiesta, il mittente continuava a vedere «In attesa» finché non riapriva l'app (l'elenco si aggiornava solo all'apertura). Corretto: la scheda Amici si aggiorna da sola ogni 20 secondi mentre è visibile e l'app è aperta (niente aggiornamenti in background), più «trascina per aggiornare». Da controllare: A manda la richiesta, B accetta, A deve vedere B tra gli Amici entro circa 20 secondi senza fare niente.
