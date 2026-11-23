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
