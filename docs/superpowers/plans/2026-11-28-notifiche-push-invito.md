# Avvisi push, link d'invito e icone (piano B) — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Richieste di unirsi, risposte e inviti arrivano come notifiche push Android (banner con suono e vibrazione sopra il navigatore, bottoni Accetta/Rifiuta); il link d'invito `https://www.motoamiciapp.it/invito/<codice>` apre l'app o porta al download; icone vere al posto delle emoji.

**Architecture:** Il database crea l'avviso con un trigger e lo invia al servizio push di Expo con `pg_net` (nessun server nostro). L'app registra il token del telefono, crea i canali di notifica, gestisce il tocco e i bottoni. Il link d'invito è un collegamento verificato di Android con una pagina di ripiego sul sito Tophost.

**Tech Stack:** Supabase (`pg_net`), `expo-notifications`, Firebase Cloud Messaging (progetto dell'utente), Expo/EAS, PHP sul sito, `@expo/vector-icons`, Jest.

**Spec:** `docs/superpowers/specs/2026-11-28-notifiche-push-design.md` (e `2026-11-28-giri-di-gruppo-design.md`)

## Global Constraints

- Testi in italiano, brevissimi. Nessuna chiave segreta nel repository (la chiave dell'account di servizio Firebase si carica su Expo a mano; `google-services.json` può stare nel repository).
- Canali Android: `richieste` (importanza alta, suono e vibrazione di sistema) e `emergenza` (importanza massima, creato ora, non ancora usato).
- Destinatari: richiesta di unirsi → tutti i membri attivi del gruppo; risposta → il richiedente; invito → l'invitato. Mai a chi ha un blocco in comune con chi agisce.
- Testo dell'avviso: solo nickname e frase breve; nessun punto d'incontro o posizione nel testo.
- Il link `https://www.motoamiciapp.it/invito/<codice>` deve funzionare anche se il codice è scritto minuscolo; chi lo apre vede una conferma prima di entrare nel gruppo.
- I 279 test esistenti e i test SQL esistenti (`0002_rls`, `0004`, `0006`–`0009`) restano verdi.

## Review Focus

- **Avvisi a chi non deve riceverli:** bloccati, ex membri, gruppi conclusi; richiesta già gestita. (Task 1)
- **Azione dal popup sbagliata o ripetuta:** doppio tocco su Accetta, richiesta già gestita da un altro membro, sessione scaduta: l'app mostra l'esito, non rompe. (Task 2)
- **Telefono senza permesso notifiche o senza token:** l'app funziona lo stesso (gli avvisi restano nell'elenco dentro l'app). (Task 2)
- **Link d'invito malformato o di un gruppo concluso:** messaggio chiaro, nessun ingresso. (Task 3)
- **Emoji non supportate:** nessun «quadratino» negli avatar sui telefoni di qualche anno fa. (Task 5)

---

## Struttura dei file

- `supabase/migrations/0010_push.sql`, `supabase/tests/0010_push.sql`
- `src/notifications/`: `channels.ts`, `pushToken.ts`, `responses.ts`, `setup.ts` (+ test), `src/api/pushApi.ts`
- `src/groups/inviteUrl.ts` (+ test); modifiche a `app.json`, `App.tsx`, `index.ts`, `JoinByCode.tsx`, `MapScreen.tsx`
- `sito/invito/index.php`, `sito/invito/config.php`, `sito/.well-known/assetlinks.json`, `sito/LEGGIMI.md`
- `src/screens/AppTabs.tsx`, `src/profile/avatars.ts`
- `docs/setup-firebase-push.md` (già scritta)

### Task 1: Invio degli avvisi dal database

**Files:**
- Create: `supabase/migrations/0010_push.sql`, `supabase/tests/0010_push.sql`

**Interfaces:**
- Produces: tabella `push_tokens(token text primary key, user_id uuid, platform text 'android', updated_at timestamptz)` (nessun accesso diretto); funzioni `register_push_token(p_token text, p_platform text) returns void` e `remove_push_token(p_token text) returns void` (autenticati; un token appartiene a un solo utente: se cambia utente si riassegna); `notify_user(p_user uuid, p_title text, p_body text, p_data jsonb, p_channel text) returns void` (interna): per ogni token dell'utente chiama `net.http_post('https://exp.host/--/api/v2/push/send', …)` con `{to, title, body, data, channelId, sound: 'default', priority: 'high', categoryId}`; trigger: `after insert on join_requests` → avviso a ogni membro attivo del gruppo (titolo «Richiesta di unirsi», testo «<nickname> vuole unirsi al giro», `data = {type:'join_request', requestId, groupId}`, categoria `join_request`, canale `richieste`); `after update of status on join_requests` (a `accepted`/`declined`) → avviso al richiedente («Richiesta accettata»/«Richiesta rifiutata», `data = {type:'join_answer', requestId, groupId, status}`); `after insert or update of status on group_members` quando diventa `invited` → avviso all'invitato («<nickname> ti invita al suo giro», `data = {type:'group_invite', groupId}`). Estensione `pg_net` creata dalla migrazione (`create extension if not exists pg_net with schema extensions`). Tolti gli avvisi per i blocchi in comune.

- [ ] **Step 1: Test locale.** Nel test, prima delle prove crea uno schema finto `net` con `http_post(url text, body jsonb, headers jsonb default '{}')` che inserisce in una tabella `t.pushed(url, body)` (la prova non invia nulla). Verifiche: B e C membri attivi con un token ciascuno, D estraneo con token: D chiede → ricevono B e C (2 righe) con titolo e `data.type = 'join_request'`, mai D; D senza token → nessun errore; B accetta → una riga per D con `data.status = 'accepted'` e nessun punto d'incontro nel testo; B rifiuta un'altra richiesta → `declined`; invito di B a un amico → una riga per l'amico con `group_invite`; un utente bloccato da un membro non riceve l'avviso dell'invito (né l'invito esiste: lo impedisce già `invite_to_group`); `register_push_token` due volte con lo stesso token → una sola riga; stesso token registrato da un altro utente → riassegnato; `remove_push_token` lo toglie; accesso diretto a `push_tokens` da utente → «permission denied»; anonimo non può registrare.
- [ ] **Step 2:** Esegui i test SQL (shim, 0001–0009, helpers, il test del task): Expected: falliscono (tabella e funzioni assenti).
- [ ] **Step 3:** Scrivi `0010_push.sql`. Se `net.http_post` non esiste (database locale) la funzione `notify_user` non deve fallire: sul progetto vero `pg_net` esiste; in locale il test crea lo schema finto prima della migrazione.
- [ ] **Step 4:** Esegui tutti i test SQL: Expected: «TUTTE LE VERIFICHE SONO PASSATE». Mutazione: invia l'avviso della richiesta anche al richiedente e verifica il fallimento.
- [ ] **Step 5:** Applica al progetto, prova in transazione annullata (le richieste di `pg_net` si accodano nella stessa transazione: l'annullamento le scarta); verifica con `select count(*) from net.http_request_queue` che non ne restino. Commit `feat: invio degli avvisi push dal database`.

### Task 2: Notifiche nell'app (canali, token, tocco, bottoni)

**Files:**
- Create: `src/notifications/channels.ts`, `pushToken.ts`, `responses.ts`, `setup.ts`, `src/api/pushApi.ts`
- Modify: `package.json` (`expo-notifications`, versione compatibile con Expo 58 da `node_modules/expo/bundledNativeModules.json`), `app.json` (plugin `expo-notifications`, `android.googleServicesFile: "./google-services.json"`), `index.ts` e `App.tsx` (avvio), `src/api/index.ts` (`getPushApi()`)
- Test: `src/notifications/responses.test.ts`, `pushToken.test.ts`, `src/api/pushApi.test.ts`

**Interfaces:**
- Consumes: funzioni SQL del Task 1; `getGroupsApi().respond(requestId, accept, meet, note)` (piano A).
- Produces:
  - `channels.ts`: `CHANNELS = { richieste: { id: 'richieste', importance: 'HIGH' }, emergenza: { id: 'emergenza', importance: 'MAX' } }`; `ensureChannels(n: NotificationsLike): Promise<void>` (crea i due canali con vibrazione; idempotente).
  - `pushApi.ts`: `createPushApi(client: RpcClient)` → `{ register(token: string): Promise<void>; remove(token: string): Promise<void> }` (`register_push_token` con `p_platform: 'android'`).
  - `pushToken.ts`: `syncPushToken(deps: { permission(): Promise<'granted' | 'denied'>; getToken(): Promise<string | null>; api: { register(t: string): Promise<void> }; store: KeyValueStore }): Promise<'registered' | 'no-permission' | 'no-token'>` (non lancia mai: gli errori di rete diventano `no-token`; non rimanda lo stesso token se già registrato per questo utente).
  - `responses.ts`: `routeResponse(r: { actionIdentifier: string; data: Record<string, unknown> }): { kind: 'respond'; requestId: string; accept: boolean } | { kind: 'open'; screen: 'map' } | null`: l'azione `ACCEPT` o `DECLINE` su un `join_request` con `requestId` stringa → `respond`; tocco normale o dati sconosciuti → `open` (o `null` se i dati non hanno il tipo atteso); `handleResponse(r, deps: { respond(id: string, accept: boolean): Promise<void>; notify(msg: string): void }): Promise<void>` (esegue `respond` senza punto d'incontro; «Richiesta già gestita» → messaggio informativo; nessuna eccezione verso l'esterno).
  - `setup.ts`: `setupNotifications()` chiamato all'avvio: categoria `join_request` con azioni «Accetta» e «Rifiuta» (`opensAppToForeground: false`), canali, listener del tocco/azione, registrazione del token dopo l'accesso, rimozione del token all'uscita dall'account.

- [ ] **Step 1: Test.** `routeResponse`: azione `ACCEPT` con `requestId: 'r1'` → `{kind:'respond', requestId:'r1', accept:true}`; `DECLINE` → `accept:false`; azione di default su `join_answer` → `{kind:'open', screen:'map'}`; `ACCEPT` senza `requestId` o con numero → `null`; azione sconosciuta → `open`. `handleResponse`: `respond` che fallisce con «Richiesta già gestita» → `notify` chiamato e nessuna eccezione; altra eccezione → `notify` con il messaggio; doppia chiamata sullo stesso `requestId` entro 5 secondi → una sola `respond`. `syncPushToken`: permesso negato → `'no-permission'` senza chiamare `getToken`; `getToken` che lancia → `'no-token'`; token nuovo → `register` chiamato e `'registered'`; stesso token già nel `store` per lo stesso utente → `register` non richiamato; `register` che fallisce → `'no-token'`. `pushApi`: `register_push_token` con `p_token` e `p_platform`; `remove_push_token` con `p_token`.
- [ ] **Step 2:** `npx jest src/notifications src/api/pushApi`: Expected: falliscono.
- [ ] **Step 3:** Implementa i moduli e collega `setupNotifications()` in `index.ts`/`App.tsx`. Per il token usa `Notifications.getExpoPushTokenAsync({ projectId })` con il `projectId` di `app.json` (`extra.eas.projectId`). `google-services.json` va nella radice del progetto (lo fornisce l'utente: se manca, il passo si ferma e lo si chiede).
- [ ] **Step 4:** `npx jest` e `npx tsc --noEmit`: Expected: passano.
- [ ] **Step 5:** Commit `feat: notifiche push nell'app (canali, token, bottoni)`.

### Task 3: Link d'invito che apre l'app

**Files:**
- Create: `src/groups/inviteUrl.ts`
- Modify: `app.json` (`android.intentFilters` verificato per `https://www.motoamiciapp.it/invito`), `App.tsx` (apertura dal link), `src/screens/map/JoinByCode.tsx` (accetta un codice precompilato), `src/screens/map/MapScreen.tsx` (riceve il codice dal link)
- Test: `src/groups/inviteUrl.test.ts`

**Interfaces:**
- Produces: `parseInviteUrl(url: string): string | null` → il codice normalizzato (usa `normalizeInviteCode`) da `https://www.motoamiciapp.it/invito/<codice>` (anche senza `www`, con maiuscole/minuscole, con `?` o `#` in coda) o da `motoamici://invito/<codice>`; `null` per qualunque altro indirizzo o codice non valido.

- [ ] **Step 1: Test.** URL valido maiuscolo/minuscolo → codice maiuscolo; senza `www`; con `?x=1` e `#a`; schema `motoamici://invito/abc234`; `https://altro.it/invito/ABC234` → `null`; `…/invito/` vuoto, `…/invito/ABC` (troppo corto), `…/invito/ABCDE0` (0 non ammesso), `…/altro/ABC234` → `null`.
- [ ] **Step 2:** `npx jest inviteUrl`: Expected: fallisce.
- [ ] **Step 3:** Implementa `parseInviteUrl`; in `App.tsx` ascolta `Linking` (all'avvio e a runtime, come il recupero password) e passa il codice alla Mappa, che apre `JoinByCode` con il codice precompilato e la conferma «Vuoi entrare nel gruppo?» (non entra da solo). `app.json`: `intentFilters` con `autoVerify: true`, `scheme: 'https'`, `host: 'www.motoamiciapp.it'`, `pathPrefix: '/invito'`, categorie `BROWSABLE` e `DEFAULT`.
- [ ] **Step 4:** `npx jest` e `npx tsc --noEmit`: Expected: passano.
- [ ] **Step 5:** Commit `feat: il link d'invito apre l'app sul gruppo`.

### Task 4: Pagina d'invito sul sito (Tophost)

**Files:**
- Create: `sito/invito/index.php`, `sito/invito/config.php`, `sito/.well-known/assetlinks.json`, `sito/.htaccess`, `sito/LEGGIMI.md`

**Interfaces:**
- Produces: una cartella `sito/` da caricare in `public_html`. `config.php` contiene `APK_URL` (indirizzo di download dell'APK di prova) e `APP_PACKAGE = 'it.motoamici.prototype'`; `index.php` legge il codice dall'ultimo segmento del percorso (`/invito/<codice>`), lo valida con la stessa regola (6 caratteri dell'alfabeto ammesso, anche minuscoli) e mostra: «Ti hanno invitato a un giro con MotoAmici», il codice, il bottone «Apri nell'app» (`intent://invito/<codice>#Intent;scheme=motoamici;package=it.motoamici.prototype;end`), il bottone «Scarica l'app» (`APK_URL`) e la frase «Dopo l'installazione apri l'app e usa il codice <codice> in "Ho un codice"»; codice non valido → pagina neutra senza errori tecnici; il testo del codice viene sempre passato da `htmlspecialchars`. `.htaccess` instrada `/invito/<qualunque>` a `invito/index.php` e serve `.well-known/assetlinks.json` come `application/json`. `assetlinks.json` contiene il pacchetto e l'impronta SHA-256 della chiave di firma di EAS (da `eas credentials`; se non la si può leggere, il file resta con il segnaposto `INSERISCI_IMPRONTA_SHA256` e `LEGGIMI.md` spiega dove prenderla).

- [ ] **Step 1:** Scrivi i file; `php -l` su `index.php` (se `php` non c'è, controlla a mano la sintassi e dillo nel ledger).
- [ ] **Step 2:** Prova locale con `php -S` (se disponibile): `/invito/abc234` mostra il codice `ABC234` maiuscolo; `/invito/<script>` e `/invito/ZZZ` non mostrano il testo inserito né errori; verifica con `curl`.
- [ ] **Step 3:** Prepara `sito.zip` (fuori dal repository, nella cartella di lavoro) e scrivi in `sito/LEGGIMI.md` come caricarlo con «Gestione file» di cPanel, come cambiare `APK_URL` a ogni build e come aggiungere l'impronta di Google Play dopo la pubblicazione.
- [ ] **Step 4:** Commit `feat: pagina d'invito e file di verifica per il sito`.

### Task 5: Icone vere e avatar sicuri

**Files:**
- Modify: `package.json` (`@expo/vector-icons`, versione da `bundledNativeModules.json`), `src/screens/AppTabs.tsx` (`TabDef.icon` diventa `(color: string) => ReactNode`), `App.tsx`, `src/profile/avatars.ts`
- Test: `src/profile/avatars.test.ts`

**Interfaces:**
- Produces: tre icone `Ionicons` (`map-outline`, `people-outline`, `person-outline`) colorate blu per la scheda attiva e grigio per le altre; elenco avatar di 20 emoji tutte appartenenti ai Unicode ≤ 9.0 (2016) e quindi presenti su Android 7 e successivi; un test elenca gli avatar e verifica che nessuno superi quella soglia con una tabella interna di quelli ammessi.

- [ ] **Step 1: Test.** `avatars.test.ts`: l'elenco ha 20 voci, tutte diverse; ognuna è nella lista ammessa `SAFE_AVATARS` (tabella nel test, copiata dalla spec sopra: moto, volpe, lupo e le altre già in uso, escluse quelle introdotte dopo il 2016); `DEFAULT_AVATAR` è nell'elenco.
- [ ] **Step 2:** Esegui: Expected: fallisce se ci sono avatar fuori lista (sostituirli con altri equivalenti più vecchi); poi passa.
- [ ] **Step 3:** Sostituisci le emoji della barra con `Ionicons`; verifica `npx tsc --noEmit`, `npx jest`.
- [ ] **Step 4:** Commit `feat: icone vere nella barra e avatar supportati ovunque`.

### Task 6: Prova su telefono e build

**Files:**
- Modify: `docs/field-test.md`

- [ ] **Step 1:** Aggiungi in `docs/field-test.md` la sezione «Avvisi e link d'invito»: con il navigatore (Google Maps) in primo piano su B, A manda una richiesta: B vede il banner con suono; «Accetta» dal banner accetta senza aprire l'app; il banner su schermo bloccato; senza permesso notifiche l'app funziona lo stesso; invito WhatsApp con il link: con l'app installata si apre direttamente sulla conferma; senza app il link porta alla pagina con il download; icone uguali su Samsung e Xiaomi; avatar senza quadratini.
- [ ] **Step 2:** `npx jest` e `npx tsc --noEmit`; lancia la build con `eas build --platform android --profile development --non-interactive --no-wait` e annota il link. Commit `docs: prova degli avvisi e dei link d'invito`.

---

## Autoverifica

- **Copertura della specifica:** push con suono/vibrazione e canali (Task 2), bottoni (Task 2), chi riceve cosa (Task 1), link che apre l'app (Task 3), pagina sul sito (Task 4), icone e avatar (Task 5), prova (Task 6). L'emergenza usa il canale `emergenza` già creato ma è un passo a parte.
- **Dipendenze dall'utente:** progetto Firebase e `google-services.json`, chiave caricata su Expo (Task 2), caricamento di `sito/` su Tophost (Task 4), impronta SHA-256 (Task 4). Il Task 1 non dipende da nessuna di queste.
- **Rischi noti:** su alcuni telefoni (Xiaomi, Samsung) il risparmio batteria può ritardare o bloccare i push: l'elenco avvisi nell'app resta la rete di sicurezza; i bottoni del banner funzionano solo se il processo dell'app è vivo (durante un giro lo è); il collegamento verificato richiede l'impronta giusta, altrimenti il link si apre nel browser (la pagina di ripiego lo copre).
