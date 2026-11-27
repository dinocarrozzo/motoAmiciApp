# Mappa in tempo reale — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una scheda Mappa dove si vedono i motociclisti che condividono la posizione, con il segnaposto (moto del colore del sesso, tag amici), e dove si parte per un giro scegliendo tipo di uscita, chi ti vede e destinazione. Le regole di visibilità (approssimazione, blocchi, dati premium) le decide il server.

**Architecture:** Un «giro» (tabella `rides`) ha id uguale all'id di sessione del tracciamento già collaudato. Un trigger sui punti caricati aggiorna la posizione attuale di chi ha un giro attivo (`live_positions`). Un'unica funzione SQL `riders_in_area` restituisce chi c'è nella zona richiesta, già filtrato e con le posizioni approssimate. L'app chiede la zona ogni 10 s solo con la mappa visibile. Mappa: MapLibre con tasselli OpenFreeMap (gratuito, senza account); se non regge si passa a Google.

**Tech Stack:** Expo + TypeScript, `@maplibre/maplibre-react-native` (v11), Supabase (Postgres, funzioni SQL), Jest.

**Spec:** `docs/superpowers/specs/2026-11-22-moto-app-design.md` (sezioni 3, 10 e 11)

## Global Constraints

- Testi in italiano. Colori segnaposto: uomo `#0ea5e9` (azzurro), donna `#ec4899` (rosa), non indicato `#8b5cf6` (viola). Tag per gli amici.
- Per vedere gli altri **non** serve condividere la propria posizione (decisione dell'utente).
- Chi non è amico si vede in posizione **approssimata** (cella di circa 500 m, centro della cella); gli amici in posizione esatta.
- Bloccati invisibili nei due sensi. Chi ha scelto «Solo amici» è visto solo dagli amici.
- Dati del giro (tipo di uscita, tipo di moto, destinazione) visibili **solo ai premium**, anche per gli amici; ai free restano `null` (decide il server, non l'app).
- Sparisce dalla mappa chi non aggiorna da più di 2 minuti o ha premuto Ferma.
- La zona richiesta è limitata (al massimo 1° di lato) e restituisce al massimo 100 persone, le più vicine al centro.
- Aggiornamento della mappa ogni 10 s, solo con la scheda visibile e l'app aperta. La condivisione della propria posizione resta nel tracciamento in background già collaudato.
- Senza giro attivo non si pubblica niente, anche se il tracciamento invia punti.
- Nessuna chiave segreta nel repository. I 203 test esistenti restano verdi.

## Review Focus

- **Fuga di posizione esatta:** un non amico non deve mai ricevere coordinate esatte; due persone nella stessa cella devono avere le stesse coordinate approssimate.
- **Blocchi e visibilità:** bloccato (in un verso o nell'altro) e «Solo amici» non devono mai comparire a chi non ne ha diritto.
- **Dati premium:** un free riceve `null` per tipo di uscita, moto e destinazione.
- **Posizioni vecchie o fuori ordine:** un lotto di punti arrivato in ritardo non deve far ricomparire chi è fermo da più di 2 minuti né sovrascrivere una posizione più recente.
- **Zona non valida o enorme:** latitudine/longitudine fuori dai limiti, minimo maggiore del massimo, zona più grande di 1°: errore chiaro, non l'intero database.
- **Giro non partito:** se il tracciamento non parte (permesso negato, errore) il giro viene chiuso e non resta una persona «fantasma» sulla mappa.
- **Mappa con zero o molte persone, permesso di posizione negato, tasselli non raggiungibili:** l'app non si blocca e lo dice.
- **Risposte lente dopo aver spostato la mappa:** una risposta per una zona superata non deve sovrascrivere quella nuova.

---

## Struttura dei file

- `src/map/types.ts`, `bbox.ts`, `riderCard.ts`, `rideSetup.ts`, `rideController.ts`
- `src/api/ridersApi.ts`
- `src/screens/map/MapScreen.tsx`, `RidersMap.tsx`, `RideSetupSheet.tsx`, `RiderCard.tsx`, `TrackPanel.tsx`
- `supabase/migrations/0004_mappa.sql`, `supabase/tests/0004_mappa.sql`

### Task 1: Libreria della mappa e verifica dell'API

**Files:**
- Modify: `package.json`, `app.json` (plugin della libreria)
- Create: `docs/map-notes.md`

**Interfaces:**
- Produces: la libreria installata e le firme reali dei suoi componenti annotate in `docs/map-notes.md` (mappa, camera, marker, evento di cambio zona con i limiti visibili, stile).

- [ ] **Step 1:** `npm install @maplibre/maplibre-react-native` (versione 11 compatibile con Expo 58: la dipendenza `expo` richiede ≥54). Aggiungi il plugin in `app.json` secondo il README installato e verifica con `npx expo config --type introspect` che non dia errori.
- [ ] **Step 2:** Leggi README e tipi installati (non a memoria, l'API cambia tra versioni) e annota in `docs/map-notes.md`: come si disegna una mappa con uno stile, come si impone la camera, come si disegna un segnaposto personalizzato, come si legge la zona visibile dopo uno spostamento, come si mostra la posizione dell'utente.
- [ ] **Step 3:** Stile della mappa: `https://tiles.openfreemap.org/styles/liberty` come costante `MAP_STYLE_URL` in `src/map/types.ts` (da confermare sul telefono: il container non raggiunge quel sito).
- [ ] **Step 4:** Verifica `npx tsc --noEmit` e `npx jest`: passano. Commit `chore: libreria della mappa e note sull'API`.

### Task 2: Logica pura — zona, scheda del motociclista, impostazioni del giro

**Files:**
- Create: `src/map/types.ts`, `src/map/bbox.ts`, `src/map/riderCard.ts`, `src/map/rideSetup.ts`
- Test: `src/map/bbox.test.ts`, `src/map/riderCard.test.ts`, `src/map/rideSetup.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `RideType = 'passeggiata' | 'passeggiata-veloce' | 'enduro'`; `Visibility = 'all' | 'friends'`; `BBox = { minLat: number; minLng: number; maxLat: number; maxLng: number }`; `Rider = { id: string; nickname: string; avatar: string; gender: Gender; lat: number; lng: number; exact: boolean; isFriend: boolean; recordedAt: number /* ms */; rideType: RideType | null; bikeType: BikeType | null; destination: string | null }`; `RideSettings = { rideType: RideType; visibility: Visibility; destination: string | null }`; costanti `MAP_STYLE_URL`, `REFRESH_RIDERS_MS = 10_000`.
  - `bbox.ts`: `bboxFromBounds(sw: [number, number], ne: [number, number]): BBox` (coppie `[lng, lat]`); `clampBox(b: BBox, maxSpan = 1): BBox` (se un lato supera `maxSpan` lo riduce attorno al centro); `movedEnough(prev: BBox | null, next: BBox): boolean` (vero se `prev` è null, se il centro si è spostato di più del 25% della larghezza/altezza o se una dimensione è cambiata di più del 30%).
  - `riderCard.ts`: `markerColor(g: Gender): string`; `describeRider(r: Rider, now: number): { title: string; subtitle: string | null; lines: string[]; premiumHint: boolean; friendTag: boolean }` (titolo = nickname; `lines` contiene «Posizione approssimata (circa 500 m)» se `!exact`, «Aggiornato N s fa»/«N min fa», e, se presenti, tipo di uscita, moto e destinazione con le etichette in italiano; `premiumHint` è vero quando `rideType === null`).
  - `rideSetup.ts`: `validateRideSetup(f: { rideType: RideType | null; visibility: Visibility; destination: string }): { ok: boolean; errors: { rideType?: string; destination?: string }; value?: RideSettings }` (tipo di uscita obbligatorio e senza valore predefinito; destinazione facoltativa, tolti gli spazi, vuota → `null`, massimo 80 caratteri).

- [ ] **Step 1:** Scrivi i test (nome → asserzione): `bboxFromBounds` inverte `[lng, lat]` nei campi giusti; `clampBox` con zona di 3° → lato 1° attorno allo stesso centro, con zona di 0,2° → invariata; `movedEnough(null, b)` vero, spostamento del 10% falso, del 40% vero, zoom raddoppiato vero; `markerColor('m')` → `#0ea5e9`, `'f'` → `#ec4899`, `'x'` → `#8b5cf6`; `describeRider` di un non amico con posizione approssimata contiene «Posizione approssimata»; di un amico con `exact` no e `friendTag` vero; con `rideType` null → `premiumHint` vero e nessuna riga di dati; con dati → «Passeggiata veloce», «Naked», destinazione; età 90 s → «Aggiornato 1 min fa», 20 s → «Aggiornato 20 s fa»; `validateRideSetup` senza tipo → errore su `rideType`, destinazione di 81 caratteri → errore, `'  '` → `null`, tutto corretto → `value`.
- [ ] **Step 2:** Esegui `npx jest src/map`: fallisce (moduli assenti).
- [ ] **Step 3:** Implementa i quattro file con le firme sopra.
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: logica della mappa, della scheda e delle impostazioni del giro`.

### Task 3: Database — giri, posizioni, premium, ricerca nella zona

**Files:**
- Create: `supabase/migrations/0004_mappa.sql`, `supabase/tests/0004_mappa.sql`

**Interfaces:**
- Produces: tabelle `rides(id uuid pk, user_id uuid default auth.uid(), ride_type, visibility default 'all', destination, started_at, ended_at)`, `live_positions(user_id pk, ride_id, lat, lng, speed, recorded_at)`, `entitlements(user_id pk, premium_until)` con accesso per riga (ognuno legge solo il proprio; nessuna scrittura diretta su `live_positions` né su `entitlements`); funzioni `start_ride(p_ride_id uuid, p_ride_type text, p_visibility text, p_destination text)`, `end_ride(p_ride_id uuid)`, `is_premium(p_user uuid) returns boolean`, `riders_in_area(min_lat, min_lng, max_lat, max_lng double precision)` che restituisce `(id, nickname, avatar, gender, lat, lng, exact, is_friend, recorded_at, ride_type, bike_type, destination)`; trigger su `track_points` che aggiorna `live_positions` solo se esiste un giro attivo (`ended_at is null`) di quell'utente con id uguale al `session_id` del punto, e solo se il punto è più recente di quello già salvato.
- Regole: `start_ride` chiude gli altri giri attivi dell'utente e accetta solo `ride_type` e `visibility` ammessi; `end_ride` imposta `ended_at` e cancella la riga di `live_positions`. `riders_in_area`: esclude se stessi, bloccati nei due sensi, giri conclusi e posizioni con `recorded_at` più vecchio di 2 minuti; con `visibility = 'friends'` restituisce solo gli amici accettati; per i non amici `lat`/`lng` sono il centro di una cella di 0,0045° in latitudine e 0,0045°/cos(lat) in longitudine e `exact = false`; `ride_type`, `bike_type`, `destination` sono `null` se chi chiede non è premium; errore «Zona non valida» se le coordinate sono fuori dai limiti, non numeriche o con minimo > massimo, «Zona troppo ampia» oltre 1° di lato; al massimo 100 righe, le più vicine al centro della zona.

- [ ] **Step 1:** Scrivi `supabase/tests/0004_mappa.sql` (stesso stile di `0002_rls.sql`, con utenti A, B, C, D): giro di B attivo + punto → A lo vede nella zona; senza giro o dopo `end_ride` non compare; punto più vecchio di 2 minuti → non compare; lotto fuori ordine (punto vecchio dopo uno nuovo) non sovrascrive; B non amico → `exact = false` e coordinate uguali a quelle di C nella stessa cella, e diverse da quelle vere; B amico di A → `exact = true` e coordinate vere; B con «Solo amici» e non amico → invisibile; B bloccato da A e A bloccato da B → invisibile; A free → `ride_type`, `bike_type`, `destination` null; A premium (riga in `entitlements`) → valorizzati; zona con minimo > massimo, latitudine 95, lato 2° → errori con i messaggi indicati; 101 persone nella zona → 100 righe; `start_ride` con tipo non ammesso → errore; secondo `start_ride` chiude il primo; scrittura diretta su `live_positions` e `entitlements` da utente → vietata; anonimo → «permission denied» su `riders_in_area`.
- [ ] **Step 2:** Prova su un Postgres locale (come nel piano precedente: `supabase/tests/supabase_shim.sql`, poi 0001-0004) e fai fallire i test: Expected: errori per tabelle e funzioni assenti.
- [ ] **Step 3:** Scrivi `0004_mappa.sql` con tabelle, accesso per riga, funzioni, trigger e permessi (`revoke ... from public, anon; grant execute ... to authenticated`).
- [ ] **Step 4:** Riesegui i test locali: Expected: «TUTTE LE VERIFICHE SONO PASSATE». Controllo di mutazione: togli l'approssimazione e verifica che il test fallisca.
- [ ] **Step 5:** Applica la migrazione al progetto con l'accesso di gestione (`POST /v1/projects/uqymtqlcotuhudshwszf/database/query`), poi esegui le stesse verifiche **sul database reale dentro una transazione annullata** (`begin; … rollback;`) e controlla che non resti nessun dato di prova. Commit `feat: giri, posizioni in tempo reale e ricerca nella zona`.

### Task 4: Livello di accesso al server

**Files:**
- Create: `src/api/ridersApi.ts`
- Modify: `src/api/index.ts` (aggiunge `getRidersApi()`)
- Test: `src/api/ridersApi.test.ts`

**Interfaces:**
- Consumes: `Rider`, `RideSettings`, `BBox`, le funzioni del Task 3, `RpcClient` (già in `friendsApi.ts`).
- Produces: `createRidersApi(client: RpcClient)` → `{ startRide(id: string, s: RideSettings): Promise<void>; endRide(id: string): Promise<void>; inArea(box: BBox): Promise<Rider[]> }`. `inArea` passa `clampBox(box)` a `riders_in_area` e converte le righe (`recorded_at` in millisecondi, `ride_type` → `rideType`, ecc.). Gli errori del server diventano `Error` con lo stesso messaggio.

- [ ] **Step 1:** Scrivi i test con un client finto: `startRide` chiama `start_ride` con `p_ride_id`, `p_ride_type`, `p_visibility`, `p_destination`; `endRide` chiama `end_ride` con `p_ride_id`; `inArea` con zona più larga di 1° passa al server una zona ridotta; le righe vengono convertite (`recorded_at` ISO → ms, campi in camelCase, `null` mantenuti); risposta vuota o `null` → `[]`; errore «Zona troppo ampia» rilanciato come `Error`.
- [ ] **Step 2:** Esegui `npx jest ridersApi`: fallisce.
- [ ] **Step 3:** Implementa `ridersApi.ts` e aggiungi `getRidersApi()` a `src/api/index.ts`.
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: accesso al server per giri e motociclisti nella zona`.

### Task 5: Avvio e chiusura del giro

**Files:**
- Create: `src/map/rideController.ts`
- Test: `src/map/rideController.test.ts`

**Interfaces:**
- Consumes: `RideSettings`, `TrackerStatus` (da `src/tracking/tracker.ts`), `ridersApi.startRide/endRide`.
- Produces: `createRideController(deps: { api: { startRide(id: string, s: RideSettings): Promise<void>; endRide(id: string): Promise<void> }; tracker: { start(sessionId: string): Promise<TrackerStatus>; stop(): Promise<void> }; newId: () => string }): { start(s: RideSettings): Promise<{ status: TrackerStatus; rideId: string | null }>; stop(): Promise<void>; currentRideId(): string | null }`. `start` crea il giro con un id nuovo, poi avvia il tracciamento con lo stesso id come sessione; se il tracciamento non parte, chiude subito il giro e restituisce lo stato. `stop` ferma il tracciamento e poi chiude il giro senza mai lanciare (la rete può mancare).

- [ ] **Step 1:** Scrivi i test: `start` chiama `startRide(id, settings)` e poi `tracker.start(id)` con lo stesso id; `startRide` che fallisce → `start` rilancia l'errore e il tracciamento non parte; tracciamento negato (`permission-denied`) → `endRide(id)` chiamato e `rideId` null; `stop` chiama `tracker.stop()` e poi `endRide`; `endRide` che fallisce o non risponde → `stop` termina comunque; `stop` senza giro attivo non chiama `endRide`; secondo `stop` non richiama `endRide`.
- [ ] **Step 2:** Esegui `npx jest rideController`: fallisce.
- [ ] **Step 3:** Implementa `createRideController` (la chiusura del giro ha un tempo massimo di 5 s).
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: avvio e chiusura del giro`.

### Task 6: Schermata Mappa

**Files:**
- Create: `src/screens/map/MapScreen.tsx`, `RidersMap.tsx`, `RideSetupSheet.tsx`, `RiderCard.tsx`, `TrackPanel.tsx`, `src/map/useRiders.ts`
- Test: `src/map/useRiders.test.ts`
- Modify: `src/screens/TrackScreen.tsx` (la logica di Avvia/Ferma e i contatori diventano `TrackPanel`, usato dalla Mappa)

**Interfaces:**
- Produces: `createRidersFeed(deps: { fetch: (box: BBox) => Promise<Rider[]>; onRiders: (r: Rider[]) => void; onError: (m: string) => void }): { setBox(b: BBox): void; refresh(): Promise<void>; dispose(): void }`: richiede la zona corrente solo se `movedEnough` rispetto all'ultima richiesta (oppure con `refresh()`), ignora le risposte di richieste superate e, dopo un errore, tiene l'ultimo elenco buono e chiama `onError`. `RidersMap` isola la libreria: props `riders: Rider[]`, `onBoundsChange(box: BBox)`, `onSelect(r: Rider)`, `showUser: boolean`.

- [ ] **Step 1:** Test di `createRidersFeed` con timer finti: prima zona → una richiesta; spostamento piccolo → nessuna richiesta; spostamento grande → una richiesta; due richieste in volo, la vecchia risponde dopo la nuova → `onRiders` non riceve quella vecchia; errore → `onError` e nessun azzeramento dell'elenco; dopo `dispose()` non arriva più nulla.
- [ ] **Step 2:** Esegui `npx jest useRiders`: fallisce. Implementa `useRiders.ts`.
- [ ] **Step 3:** Costruisci `RidersMap` (stile `MAP_STYLE_URL`, segnaposto moto colorata con `markerColor`, bordo o tag per gli amici, avatar emoji nella scheda), `RiderCard` (usa `describeRider`; se `premiumHint` mostra «I dati del giro e della moto sono per gli utenti Premium»), `RideSetupSheet` (tipo di uscita obbligatorio e senza scelta predefinita, «Tutti»/«Solo amici» con «Tutti» predefinito, destinazione facoltativa, usa `validateRideSetup`), `TrackPanel` e `MapScreen` (mappa a schermo intero con il pannello in basso: «Parti» oppure stato del giro con «Ferma»; aggiornamento con il ciclo già esistente `createRefreshLoop` ogni `REFRESH_RIDERS_MS`, attivo solo con la scheda visibile e l'app aperta; permesso di posizione negato → la mappa si vede lo stesso, senza il punto blu; errore di rete → avviso, ultimo elenco mantenuto).
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: schermata mappa con segnaposto, scheda e partenza del giro`.

### Task 7: Collegamento nell'app, build e prova

**Files:**
- Modify: `App.tsx` (la scheda «Giro» diventa «Mappa» e prima nell'ordine), `docs/field-test.md` (sezione «Mappa»)

- [ ] **Step 1:** Collega `MapScreen` nelle schede: Mappa, Amici, Profilo. Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 2:** Scrivi in `docs/field-test.md` la prova con due telefoni: A parte («Tutti»), B guarda la mappa e vede A in posizione approssimata (anche muovendosi sotto i 500 m il segnaposto resta fermo nella cella); dopo l'amicizia vede A esatto con il tag; A con «Solo amici» e non amico → invisibile; A blocca B → invisibile; B free non vede i dati del giro di A, B premium sì (premium assegnato dal progetto con una riga in `entitlements`); A preme Ferma o si ferma per 2 minuti → sparisce; B senza condividere vede comunque gli altri; permesso di posizione negato → mappa visibile senza il punto blu.
- [ ] **Step 3:** Lancia la build di sviluppo con `eas build`. Commit `docs: prova della mappa su due telefoni`.

---

## Autoverifica

- **Copertura:** mappa e segnaposto (Task 1, 2, 6), partenza con tipo/visibilità/destinazione (Task 2, 5, 6), regole di visibilità, approssimazione, blocchi e premium nel server (Task 3), aggiornamento ogni 10 s a mappa visibile (Task 6), vedere senza condividere (Task 3, 6).
- **Fuori da questo piano:** richieste di unirsi al giro e chat, percorso tracciato da GPX o da mappa (qui solo la destinazione in testo), notifiche, abbonamento vero (qui `entitlements` si assegna a mano), scelta tra servizio di mappe gratuito e Google.
- **Rischi noti:** il servizio di tasselli gratuito non ha garanzie; i tasselli non sono raggiungibili dal container, quindi lo stile della mappa si verifica solo sul telefono; l'API della libreria va letta dai tipi installati, non ricordata.
