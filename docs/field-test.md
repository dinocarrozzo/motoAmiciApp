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
