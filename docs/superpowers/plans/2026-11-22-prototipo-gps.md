# Prototipo GPS in background — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un'app minima (Android) che traccia la posizione in background per ore su telefoni Samsung e Xiaomi, manda i punti a un server e permette di misurare se il tracciamento regge, prima di costruire il resto di MotoAmici.

**Architecture:** App Expo (React Native, TypeScript) con una libreria nativa di geolocalizzazione in background. I punti passano per un buffer persistente (sopravvive a mancanza di rete e a chiusure dell'app) e vengono caricati su Supabase. Uno script legge i punti di una sessione e riporta buchi e batteria. La logica pura (buffer, analisi dei buchi, istruzioni batteria) è testabile in Jest nel container; il GPS stesso si prova solo su telefoni veri.

**Tech Stack:** Expo + TypeScript, `react-native-background-geolocation` (Transistorsoft), Supabase (Postgres, accesso anonimo), Jest, EAS Build (APK di sviluppo).

**Spec:** `docs/superpowers/specs/2026-11-22-moto-app-design.md` (sezioni 4, 5, 6 punto 1)

## Global Constraints

- Prototipo **usa-e-getta**: non si tengono le schermate, ma restano buffer, analisi dei buchi e istruzioni batteria se utili. Tenerli è una nuova decisione.
- Solo Android in questa fase (test su Samsung e Xiaomi). iPhone non è coperto.
- Testi dell'interfaccia in italiano.
- Il tracciamento deve continuare a schermo bloccato: servizio in primo piano con notifica fissa su Android.
- Nessuna chiave segreta nel repository. `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (non versionato); la chiave di servizio solo come variabile d'ambiente dello script.
- Libreria GPS con licenza a pagamento per le build di rilascio Android: in sviluppo funziona senza, prezzo e condizioni da verificare prima della versione finale. Se non regge la prova, fallback `expo-location` con `TaskManager`.

## Review Focus

- **Niente rete in montagna:** i punti si accumulano e vengono caricati in ordine quando torna il segnale, senza duplicati.
- **Ripetizione dell'invio dopo un errore:** lo stesso punto mandato due volte non crea due righe (chiave unica sessione + istante).
- **App chiusa dal sistema con punti non ancora inviati:** i punti pendenti si recuperano al riavvio.
- **Permesso "solo mentre l'app è in uso" o negato:** l'app lo dichiara e non fa finta di tracciare.
- **Orologio o punti fuori ordine, sessione vuota o con un solo punto:** l'analisi non va in errore né restituisce NaN.

---

## Struttura dei file

- `app/` (Expo Router) o `App.tsx`: una sola schermata. Scelta del costruttore.
- `src/tracking/types.ts`: tipo `TrackPoint`.
- `src/tracking/gaps.ts`: analisi dei buchi (pura).
- `src/tracking/pointBuffer.ts`: buffer persistente con invio a lotti (puro, con dipendenze iniettate).
- `src/tracking/tracker.ts`: unico punto di contatto con la libreria GPS.
- `src/api/trackApi.ts`: accesso anonimo e invio a Supabase.
- `src/battery/batteryInstructions.ts`: istruzioni per marca (pura).
- `src/screens/TrackScreen.tsx`, `src/screens/BatterySetupScreen.tsx`.
- `supabase/migrations/0001_track_points.sql`, `scripts/analyze-session.ts`.
- `docs/setup-supabase.md`, `docs/field-test.md`.

### Task 1: Scheletro del progetto

**Files:**
- Create: `package.json`, `tsconfig.json`, `app.json`, `.gitignore`, `.env.example`, `jest.config.js`, `README.md`, `src/tracking/types.ts`
- Test: `src/tracking/types.test.ts`

**Interfaces:**
- Produces: `TrackPoint = { sessionId: string; recordedAt: number /* ms da epoch */; lat: number; lng: number; accuracy: number | null; speed: number | null /* m/s */ }` in `src/tracking/types.ts`.

- [ ] **Step 1:** Crea il progetto Expo con TypeScript (`npx create-expo-app` nella radice, template vuoto TypeScript), pacchetto Android `it.motoamici.prototype`, nome app "MotoAmici GPS (prova)". Aggiungi Jest con preset `jest-expo`.
- [ ] **Step 2:** Test `types.test.ts`: un oggetto `TrackPoint` con `accuracy: null` e `speed: null` compila e `npx tsc --noEmit` passa.
- [ ] **Step 3:** Aggiungi `.env`, `node_modules`, `.expo` a `.gitignore`; `.env.example` con le due variabili `EXPO_PUBLIC_SUPABASE_*`.
- [ ] **Step 4:** Verifica: `npx jest` e `npx tsc --noEmit` passano.
- [ ] **Step 5:** Commit `chore: scheletro del prototipo GPS`.

### Task 2: Analisi dei buchi

**Files:**
- Create: `src/tracking/gaps.ts`
- Test: `src/tracking/gaps.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`.
- Produces: `analyzeGaps(points: TrackPoint[], opts: { maxGapSec: number; movingSpeedMs: number }): GapReport`, con `GapReport = { pointCount: number; durationSec: number; medianIntervalSec: number; maxGapSec: number; gaps: { fromMs: number; toMs: number; seconds: number }[] }`.
- Regola: ordina per `recordedAt`; un buco è un intervallo tra due punti consecutivi più lungo di `maxGapSec` il cui punto di partenza era in movimento (`speed >= movingSpeedMs`, `speed null` conta come in movimento).

- [ ] **Step 1:** Scrivi i test (nome → asserzione):
  - `punti ogni 5 s → nessun buco`: `gaps` vuoto, `medianIntervalSec` 5.
  - `buco di 60 s con maxGapSec 30 → un buco di 60 s`.
  - `buco di 60 s da fermo (speed 0) → non conta`.
  - `punti fuori ordine → stesso risultato dei punti ordinati`.
  - `lista vuota → pointCount 0, durationSec 0, maxGapSec 0, medianIntervalSec 0`, nessun NaN.
  - `un solo punto → stessi zeri, nessun NaN`.
- [ ] **Step 2:** Esegui `npx jest gaps` e verifica che fallisca (funzione assente).
- [ ] **Step 3:** Implementa `analyzeGaps` in `src/tracking/gaps.ts`.
- [ ] **Step 4:** Esegui `npx jest gaps`: tutti passano.
- [ ] **Step 5:** Commit `feat: analisi dei buchi del tracciamento`.

### Task 3: Buffer persistente dei punti

**Files:**
- Create: `src/tracking/pointBuffer.ts`
- Test: `src/tracking/pointBuffer.test.ts`

**Interfaces:**
- Consumes: `TrackPoint`.
- Produces: `interface KeyValueStore { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }` e `class PointBuffer` con costruttore `new PointBuffer({ store: KeyValueStore; send: (points: TrackPoint[]) => Promise<void>; batchSize?: number /* default 20 */; storageKey?: string })`, metodi `add(p: TrackPoint): Promise<void>`, `flush(): Promise<{ sent: number; pending: number }>` (non lancia mai: se `send` fallisce tiene i punti e restituisce i pendenti), `pendingCount(): Promise<number>`.

- [ ] **Step 1:** Scrivi i test con uno store in memoria e un `send` finto:
  - `add salva nello store`: dopo `add`, una nuova istanza sullo stesso store ha `pendingCount() === 1`.
  - `flush invia in ordine e a lotti`: 45 punti, `batchSize` 20 → `send` chiamato 3 volte con 20, 20, 5 punti nell'ordine di inserimento; esito `{ sent: 45, pending: 0 }`.
  - `flush con send che fallisce → non lancia, mantiene i punti`: esito `{ sent: 0, pending: 45 }`.
  - `dopo un errore, il flush successivo invia tutto una volta sola`: nessun punto inviato due volte.
  - `una nuova istanza recupera i punti pendenti dopo il riavvio` e li invia.
- [ ] **Step 2:** Esegui `npx jest pointBuffer`: fallisce.
- [ ] **Step 3:** Implementa `PointBuffer`; salva l'intera coda come JSON nello store a ogni `add` e dopo ogni lotto inviato.
- [ ] **Step 4:** Esegui `npx jest pointBuffer`: passa.
- [ ] **Step 5:** Commit `feat: buffer persistente dei punti GPS`.

### Task 4: Database e invio al server

**Files:**
- Create: `supabase/migrations/0001_track_points.sql`, `src/api/trackApi.ts`, `docs/setup-supabase.md`
- Test: `src/api/trackApi.test.ts` (client Supabase finto)

**Interfaces:**
- Consumes: `TrackPoint`, `KeyValueStore`.
- Produces: `ensureSignedIn(): Promise<void>` (accesso anonimo se non già dentro) e `sendPoints(points: TrackPoint[]): Promise<void>` (lancia in caso di errore, così `PointBuffer` tiene i punti).
- Tabella `track_points(session_id uuid, user_id uuid default auth.uid(), recorded_at timestamptz, lat double precision, lng double precision, accuracy real, speed real, received_at timestamptz default now(), primary key (session_id, recorded_at))`. Accesso riga per riga: ognuno inserisce e legge solo le proprie righe.

- [ ] **Step 1:** Scrivi i test su `sendPoints` con client finto: `converte recordedAt in ISO e usa upsert con onConflict session_id,recorded_at e ignoreDuplicates`; `un errore del client viene rilanciato`.
- [ ] **Step 2:** Esegui `npx jest trackApi`: fallisce.
- [ ] **Step 3:** Scrivi la migrazione SQL (tabella, accesso per riga, accesso anonimo abilitato nelle impostazioni) e implementa `trackApi.ts`.
- [ ] **Step 4:** Scrivi `docs/setup-supabase.md`: **passi che fa l'utente** — creare il progetto Supabase gratuito, abilitare "Anonymous sign-ins", eseguire la migrazione, copiare URL e chiave anon in `.env`. Verifica manuale: dopo il primo invio dal telefono compare una riga in `track_points`.
- [ ] **Step 5:** Esegui `npx jest trackApi`: passa. Commit `feat: tabella dei punti e invio al server`.

### Task 5: Istruzioni risparmio batteria per marca

**Files:**
- Create: `src/battery/batteryInstructions.ts`, `src/screens/BatterySetupScreen.tsx`
- Test: `src/battery/batteryInstructions.test.ts`

**Interfaces:**
- Produces: `batteryInstructions(manufacturer: string): { title: string; steps: string[] }`; confronto senza distinzione di maiuscole; `samsung` → passi per "App mai in stand-by" e batteria "Senza limitazioni"; `xiaomi`, `redmi`, `poco` → passi per "Avvio automatico", "Nessuna restrizione" e blocco dell'app nelle app recenti; ogni altra marca → passi generici.

- [ ] **Step 1:** Test: `Samsung` e `SAMSUNG` danno lo stesso risultato con almeno 2 passi che citano "stand-by"; `Xiaomi`, `Redmi`, `POCO` danno passi che citano "Avvio automatico"; `Google` dà i passi generici; stringa vuota non lancia.
- [ ] **Step 2:** Esegui `npx jest batteryInstructions`: fallisce.
- [ ] **Step 3:** Implementa la funzione; la schermata legge `Device.manufacturer` (`expo-device`), mostra i passi e un tasto per aprire le impostazioni dell'app.
- [ ] **Step 4:** Esegui `npx jest batteryInstructions`: passa.
- [ ] **Step 5:** Commit `feat: guida al risparmio batteria per Samsung e Xiaomi`.

### Task 6: Servizio di tracciamento e schermata

**Files:**
- Create: `src/tracking/tracker.ts`, `src/screens/TrackScreen.tsx`
- Modify: `app.json` (permessi di posizione anche in background, servizio in primo piano)
- Test: `src/tracking/tracker.test.ts` (libreria finta)

**Interfaces:**
- Consumes: `PointBuffer`, `sendPoints`, `ensureSignedIn`.
- Produces: `startTracking(sessionId: string): Promise<TrackerStatus>`, `stopTracking(): Promise<void>` (invia i punti pendenti prima di fermarsi), `type TrackerStatus = 'tracking' | 'permission-denied' | 'foreground-only' | 'error'`.

- [ ] **Step 1:** Test con libreria finta: `permesso negato → 'permission-denied' e nessun tracciamento avviato`; `permesso solo in primo piano → 'foreground-only'`; `ogni posizione ricevuta viene aggiunta al buffer come TrackPoint`; `stopTracking esegue un flush prima di fermare`.
- [ ] **Step 2:** Esegui `npx jest tracker`: fallisce.
- [ ] **Step 3:** Implementa `tracker.ts`. Configurazione di partenza (scelta mia, da tarare col test): precisione alta, filtro di distanza 10 m, servizio in primo piano con notifica "MotoAmici sta tracciando il giro", avvio automatico dopo riavvio, ricezione dei punti anche con app chiusa. Controllo periodico (`flush`) ogni 15 s.
- [ ] **Step 4:** `TrackScreen`: tasti Avvia/Ferma, e a vista punti registrati, punti inviati, punti in attesa, ora dell'ultimo invio, stato del permesso. Se lo stato non è `'tracking'`, mostra un avviso rosso in italiano che spiega come concedere "Consenti sempre".
- [ ] **Step 5:** Esegui `npx jest` e `npx tsc --noEmit`: passano. Commit `feat: tracciamento in background con invio al server`.

### Task 7: Build, prova sul campo e referto

**Files:**
- Create: `eas.json`, `scripts/analyze-session.ts`, `docs/field-test.md`
- Test: `scripts/analyze-session.test.ts` (formattazione del referto)

**Interfaces:**
- Consumes: `analyzeGaps`.
- Produces: `formatReport(report: GapReport, batteryStartPct: number, batteryEndPct: number, hours: number): string` e il comando `npx tsx scripts/analyze-session.ts <sessionId> --battery-start 90 --battery-end 74 --hours 2`, che legge `track_points` con `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` dall'ambiente.

- [ ] **Step 1:** Test su `formatReport`: contiene punti totali, buco massimo, numero di buchi e consumo di batteria in %/h (es. 16 punti percentuali in 2 h → "8,0 %/h"); con `hours` 0 non divide per zero.
- [ ] **Step 2:** Esegui il test: fallisce. Implementa `formatReport` e lo script.
- [ ] **Step 3:** Scrivi `eas.json` con profilo `development` che produce un APK. **Passi dell'utente**: creare un account Expo gratuito, eseguire `eas build --platform android --profile development` (oppure fornire un token Expo alla sessione), installare l'APK.
- [ ] **Step 4:** Scrivi `docs/field-test.md`: protocollo — telefono carico al 90% o più, schermata di guida batteria completata, telefono in tasca o sul supporto a schermo bloccato, giro di almeno 2 ore, annotare la batteria all'inizio e alla fine. Un test per Samsung e uno per Xiaomi. **Criteri di successo proposti (da confermare):** nessun buco superiore a 120 s in movimento, salvo zone senza copertura documentate; il 95% degli intervalli ≤ 15 s; consumo non oltre 8% l'ora.
- [ ] **Step 5:** Esegui `npx jest`: passa. Commit `docs: protocollo della prova sul campo e script del referto`.

---

## Autoverifica

- **Copertura del progetto:** il piano copre solo il punto 1 della sezione 6 (prototipo GPS) e le scelte di sezione 4 e 5 che lo riguardano (libreria specializzata, guida batteria Samsung/Xiaomi, servizio in primo piano). Account, mappa, giri, emergenza, abbonamenti e pubblicazione sono fuori da questo piano di proposito.
- **Coerenza dei tipi:** `TrackPoint`, `KeyValueStore`, `PointBuffer`, `sendPoints`, `analyzeGaps` e `GapReport` hanno gli stessi nomi in tutti i task.
- **Proporzione:** il piano è più corto del progetto e non contiene il codice dei programmi, solo firme, test e valori.
- **Da verificare in esecuzione:** nome esatto e configurazione del plugin Expo della libreria GPS (cambia tra le versioni), e le condizioni attuali della sua licenza per Android.
- **Dopo il test:** se i criteri non sono rispettati, si prova il fallback `expo-location` o, in ultima istanza, il tracciamento nativo solo per quella parte; si riscrive il piano successivo in base ai risultati.
