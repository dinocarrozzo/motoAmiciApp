# Giri di gruppo: gruppi, richieste, inviti (piano A) — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni giro appartiene a un gruppo con membri; un estraneo può chiedere di unirsi, un membro qualsiasi risponde (con punto d'incontro e nota); si invita con WhatsApp (testo + codice) o in app agli amici; richieste, risposte e inviti compaiono come avvisi nell'app.

**Architecture:** Entità `ride_groups` + `group_members`; ogni `rides` ha un `group_id`. Tutte le regole (visibilità, blocchi, premium, prima risposta vince, cooldown) sono funzioni SQL nel database, provate prima in locale e poi sul progetto vero. L'app legge richieste/inviti/risposte con funzioni di elenco ogni 10 s mentre è aperta. Le notifiche push e la pagina web d'invito sono il **piano B** (dopo, perché servono Firebase e il sito).

**Tech Stack:** Supabase (Postgres, funzioni SQL), Expo + TypeScript, Jest, MapLibre già presente.

**Spec:** `docs/superpowers/specs/2026-11-28-giri-di-gruppo-design.md`

## Global Constraints

- Testi in italiano. Nessuna chiave segreta nel repository. I 241 test esistenti restano verdi; i test SQL esistenti (`0002_rls`, `0004_mappa`) restano verdi.
- **Nessun limite** al numero di membri né alle richieste in attesa totali. Una sola richiesta `pending` per (gruppo, richiedente); dopo un rifiuto, **1 ora** di attesa per riprovare sullo stesso gruppo.
- **La prima risposta vince**: la seconda trova «Richiesta già gestita».
- Chiunque può rispondere alle richieste del proprio gruppo e chiederle: free e premium. L'**elenco partecipanti** lo vedono i premium e i membri del gruppo; tipo di uscita, destinazione e numero partecipanti sulla mappa solo i premium (e i membri).
- Blocchi nei due sensi con **qualunque** membro attivo: non si può richiedere, entrare con codice, essere invitati o accettati.
- Posizione esatta tra membri dello stesso gruppo; per gli altri resta l'approssimazione (cella 0,0045°) già esistente.
- Chiudere il giro = uscire dal gruppo. L'ultimo giro che finisce chiude il gruppo (il codice non vale più). Se esce chi l'ha creato, il ruolo passa al membro attivo con giro in corso più anziano.
- Punto d'incontro e nota: l'app non li mostra oltre 24 ore dalla risposta; `start_ride` cancella le richieste concluse da più di 24 ore.
- Funzioni `security definer`, `set search_path = public`, `revoke ... from public, anon`, `grant execute ... to authenticated`; nessuna scrittura diretta sulle nuove tabelle.
- Codice d'invito: 6 caratteri dell'alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, univoco.
- Link d'invito: `https://www.motoamiciapp.it/invito/<codice>` (la pagina è del piano B) accompagnato sempre dal codice scritto nel messaggio.

## Review Focus

- **Bypass dei blocchi/visibilità:** richiedere, entrare con codice, essere invitato o accettato con un blocco (in un verso o nell'altro) verso un membro; richiedere un gruppo «Solo amici» da non amico; richiedere un gruppo che non si vede più. (Task 3, 4)
- **Risposte simultanee:** due membri rispondono insieme; richiesta ripetuta; risposta a richiesta già annullata o conclusa; richiedente già membro. (Task 3)
- **Free vs premium:** un free non membro non riceve né elenco partecipanti, né conteggio, né dati del giro; un free può chiedere e rispondere. (Task 2, 3)
- **Ciclo di vita:** il creatore esce, l'ultimo esce, si entra con un codice di un gruppo concluso, un membro entra e poi avvia un altro giro, si rientra dopo essere usciti. (Task 1, 4)
- **Codice sbagliato o malformato:** vuoto, minuscole, spazi, caratteri non ammessi, codice inesistente: messaggio chiaro, mai un errore tecnico. (Task 4, 6)

---

## Struttura dei file

- SQL: `supabase/migrations/0006_gruppi.sql`, `0007_mappa_gruppi.sql`, `0008_richieste.sql`, `0009_inviti.sql`; test in `supabase/tests/helpers.sql`, `0006_gruppi.sql`, `0007_mappa_gruppi.sql`, `0008_richieste.sql`, `0009_inviti.sql`
- `src/groups/types.ts`, `inviteCode.ts`, `inviteMessage.ts`, `requestState.ts`, `meetPoint.ts`, `useGroupState.ts`
- `src/api/groupsApi.ts` (+ `getGroupsApi` in `src/api/index.ts`)
- `src/screens/map/`: `GroupPanel.tsx`, `RequestsInbox.tsx`, `AcceptSheet.tsx`, `JoinByCode.tsx`; modifiche a `RiderCard.tsx`, `TrackPanel.tsx`, `MapScreen.tsx`, `RidersMap.tsx`

Comando per i test SQL (da usare in tutti i task SQL; il file `/tmp/runsql.sh` va ricreato se manca: crea il database `mt`, lancia in ordine con `psql -v ON_ERROR_STOP=1`):
`supabase/tests/supabase_shim.sql`, `migrations/0001..000N`, `tests/helpers.sql`, poi il test del task.

### Task 1: Gruppi, membri e ciclo di vita del giro (database)

**Files:**
- Create: `supabase/migrations/0006_gruppi.sql`, `supabase/tests/helpers.sql`, `supabase/tests/0006_gruppi.sql`

**Interfaces:**
- Produces: tabelle `ride_groups(id uuid pk, owner_id uuid, ride_type text, destination text, invite_code text unique, created_at, ended_at)`, `group_members(group_id, user_id, role text 'owner'|'member', status text 'invited'|'active'|'left', invited_by uuid null, joined_at)` pk `(group_id, user_id)`, colonna `rides.group_id uuid`; funzioni
  - `start_ride(p_ride_id uuid, p_ride_type text, p_visibility text, p_destination text, p_group_id uuid default null) returns uuid` (id del gruppo). Senza `p_group_id` crea un gruppo di cui il chiamante è `owner`; con `p_group_id` il chiamante deve essere membro `active` di un gruppo non concluso e tipo/destinazione vengono dal gruppo (`p_ride_type` può essere null). Prima chiude il suo giro attivo precedente con `finish_ride`. Mantiene i controlli di 0004 (tipo, visibilità, destinazione ≤ 80, id altrui «Giro non valido», ripetizione idempotente dello stesso giro attivo). Rimuove la vecchia firma a 4 argomenti (`drop function` prima).
  - `end_ride(p_ride_id uuid) returns void`
  - `finish_ride(p_user uuid, p_ride uuid) returns void` (interna, nessun permesso agli utenti): chiude il giro, cancella `live_positions`, mette `left` l'adesione, passa il ruolo di creatore e chiude il gruppo come da vincoli.
  - `my_group() returns table (group_id uuid, ride_type text, destination text, invite_code text, role text, member_count integer, ride_id uuid)` (0 o 1 riga: il gruppo attivo del chiamante; `ride_id` null se non ha ancora un giro).
  - `is_group_member(p_user uuid, p_group uuid) returns boolean` (interna: adesione `active`).
- Helpers `t.assert`, `t.as_user`, `t.as_anon`, `t.as_admin`, `t.fails` spostati in `supabase/tests/helpers.sql` (stesso codice di `tests/0004_mappa.sql`, che continua a funzionare).

- [ ] **Step 1: Test.** In `tests/0006_gruppi.sql` (utenti A,B,C con profili): `start_ride` senza gruppo → `my_group()` di A ha ruolo `owner`, `member_count = 1`, `invite_code` di 6 caratteri nell'alfabeto, `ride_id` = id del giro; un secondo `start_ride` di A chiude il primo giro e il vecchio gruppo (`ended_at` valorizzato); `start_ride` con `p_group_id` da non membro → «Gruppo non valido»; dopo aver reso B membro (insert da admin), `start_ride(..., p_group_id)` di B eredita tipo e destinazione del gruppo anche passando `p_ride_type` null; A termina con `end_ride`: il ruolo passa a B (`owner`) e il gruppo resta attivo; B termina: gruppo concluso, `my_group()` vuota, `live_positions` senza righe dei due; il codice è univoco tra 50 gruppi creati in un ciclo; scritture dirette su `ride_groups`/`group_members` → «permission denied»; le prove di 0004 sul vecchio `start_ride` (tipo/visibilità/destinazione non validi, id altrui) passano ancora.
- [ ] **Step 2:** Esegui i test SQL: Expected: falliscono (tabelle e funzioni assenti).
- [ ] **Step 3:** Scrivi `0006_gruppi.sql` con tabelle, accesso per riga (lettura solo dei propri `group_members`), le funzioni sopra e i permessi. Per le righe già esistenti in `rides` basta lasciare `group_id` nullo; `finish_ride` ignora i giri senza gruppo.
- [ ] **Step 4:** Rilancia i test (shim, 0001–0006, helpers, `0004_mappa.sql` poi `0006_gruppi.sql`): Expected: «TUTTE LE VERIFICHE SONO PASSATE». Controllo di mutazione: togli il passaggio del ruolo di creatore e verifica che il test fallisca.
- [ ] **Step 5:** Applica la migrazione al progetto con l'accesso di gestione e rilancia il test 0006 dentro una transazione annullata (come in 0004: sostituire l'esito finale con un errore voluto `ESITO_OK_ROLLBACK`), verifica che non resti nulla. Commit `feat: gruppi, membri e ciclo di vita del giro`.

### Task 2: Mappa con i gruppi e elenco partecipanti (database)

**Files:**
- Create: `supabase/migrations/0007_mappa_gruppi.sql`, `supabase/tests/0007_mappa_gruppi.sql`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `riders_in_area(min_lat, min_lng, max_lat, max_lng double precision)` ricreata (`drop function` + `create function`: cambia il tipo restituito) con le colonne di prima più `group_id uuid` e `member_count integer`; stesse regole di 0005 (zona confrontata con la posizione mostrata). Per i membri dello stesso gruppo del chiamante: `exact = true`, `lat/lng` veri, e dati del giro visibili anche se free. `member_count` (membri attivi) è valorizzato solo per premium e membri, altrimenti null.
  - `group_participants(p_group_id uuid) returns table (id uuid, nickname text, avatar text, gender text, role text, riding boolean)`: ammesso se il chiamante è membro attivo, oppure è premium **e** può vedere il gruppo (`can_see_group`); altrimenti errore «Elenco non disponibile». Ordinato per `joined_at`, al massimo 500 righe di sicurezza.
  - `can_see_group(p_viewer uuid, p_group uuid) returns boolean` (interna): esiste un membro attivo con giro in corso e posizione recente (< 2 minuti) visibile al `p_viewer` (visibilità «Tutti», oppure «Solo amici» e amicizia accettata) **e** nessun blocco tra `p_viewer` e alcun membro attivo.

- [ ] **Step 1: Test** (utenti A premium, F free, B e C membri dello stesso gruppo con giro e punto): F vede `group_id` ma `member_count`, `ride_type`, `destination` null; A (premium) li vede; B vede C esatto (`exact` vero, coordinate vere) pur non essendo amici; F con zona minuscola attorno alla posizione vera di B non lo trova (regola 0005 invariata); `group_participants`: F non membro → «Elenco non disponibile», A premium → 2 righe in ordine di ingresso, B (membro free) → 2 righe; blocco tra A e C → A non vede nessuno dei due e l'elenco gli è negato; gruppo concluso → «Elenco non disponibile»; anonimo → «permission denied».
- [ ] **Step 2:** Esegui: Expected: falliscono.
- [ ] **Step 3:** Scrivi `0007_mappa_gruppi.sql`. Riutilizza la query di 0005; aggiungi `can_see_group` interna e permessi (`revoke` da public/anon; `grant execute` a authenticated sulle due funzioni pubbliche).
- [ ] **Step 4:** Esegui i test (anche `0004_mappa.sql` e `0006_gruppi.sql`): Expected: tutti passati. Mutazione: rendi `member_count` visibile ai free e verifica il fallimento.
- [ ] **Step 5:** Applica al progetto, prova in transazione annullata, commit `feat: gruppi sulla mappa e elenco partecipanti`.

### Task 3: Richieste di unirsi (database)

**Files:**
- Create: `supabase/migrations/0008_richieste.sql`, `supabase/tests/0008_richieste.sql`

**Interfaces:**
- Consumes: Task 1, 2 (`can_see_group`, `is_group_member`).
- Produces: tabella `join_requests(id uuid pk default gen_random_uuid(), group_id, requester_id, message text null (≤ 140), status text 'pending'|'accepted'|'declined'|'cancelled', answered_by uuid null, answered_at, meet_lat double precision null, meet_lng double precision null, meet_note text null (≤ 140), created_at)`, indice unico parziale su `(group_id, requester_id) where status = 'pending'`; funzioni
  - `request_join(p_group_id uuid, p_message text) returns uuid`: errori «Gruppo non trovato» (non lo vede, concluso, blocchi), «Sei già nel gruppo», «Richiesta già inviata», «Potrai riprovare tra N minuti» (un'ora dall'ultimo rifiuto sullo stesso gruppo).
  - `cancel_join_request(p_request_id uuid) returns void` (solo il richiedente, solo se `pending`).
  - `respond_join_request(p_request_id uuid, p_accept boolean, p_meet_lat double precision, p_meet_lng double precision, p_note text) returns void`: ammesso a ogni membro attivo del gruppo; aggiorna solo se ancora `pending` (altrimenti «Richiesta già gestita»); se `p_accept`, il richiedente diventa membro `active` (ruolo `member`; se aveva `left`, torna `active`) dopo il controllo dei blocchi; coordinate valide (lat −90..90, lng −180..180) o entrambe null.
  - `list_incoming_requests() returns table (request_id uuid, group_id uuid, requester_id uuid, nickname text, avatar text, gender text, message text, created_at timestamptz)`: richieste `pending` dei gruppi di cui il chiamante è membro attivo.
  - `list_my_requests() returns table (request_id uuid, group_id uuid, status text, meet_lat double precision, meet_lng double precision, meet_note text, answered_at timestamptz, created_at timestamptz)`: le richieste del chiamante degli ultimi 24 ore, più recenti prima.
  - `start_ride` (di Task 1) cancella in apertura le richieste concluse da più di 24 ore dei gruppi conclusi.

- [ ] **Step 1: Test.** Utenti: B, C membri di un gruppo; D estraneo premium; E estraneo free; X bloccato da B. D e E vedono il gruppo → `request_join` ok; X → «Gruppo non trovato»; D due volte → «Richiesta già inviata»; gruppo «Solo amici» e D non amico → «Gruppo non trovato», se amico di un membro → ok; blocco di C verso D (dopo la richiesta) → `respond_join_request` accetta → errore «Richiesta non valida» e D non entra; B e C rispondono quasi insieme (due chiamate in sequenza nella stessa sessione di test): la prima accetta e D diventa membro attivo, la seconda → «Richiesta già gestita» e nessun doppio ingresso; `list_incoming_requests` mostra la richiesta a B e C e a nessun altro (né a E); dopo il rifiuto di E, `request_join` di E → «Potrai riprovare tra» e, simulando `answered_at` di un'ora e un minuto fa, passa; `cancel_join_request` da un altro utente → errore, dal richiedente ok; coordinate 95/200 → errore; `list_my_requests` di D mostra `accepted` con punto d'incontro e nota; la richiesta di chi è già membro → «Sei già nel gruppo»; free E può chiedere e un membro free può rispondere; anonimo → «permission denied».
- [ ] **Step 2:** Esegui: Expected: falliscono.
- [ ] **Step 3:** Scrivi `0008_richieste.sql`; per la prima risposta usa un `update ... where id = ... and status = 'pending'` e controlla le righe toccate (nessun «controlla e poi scrivi» separato).
- [ ] **Step 4:** Esegui tutti i test SQL: Expected: tutti passati. Mutazione: sostituisci l'`update` condizionale con uno incondizionato e verifica il fallimento del test della doppia risposta.
- [ ] **Step 5:** Applica al progetto, prova in transazione annullata, commit `feat: richieste di unirsi ai gruppi`.

### Task 4: Inviti con codice e inviti agli amici (database)

**Files:**
- Create: `supabase/migrations/0009_inviti.sql`, `supabase/tests/0009_inviti.sql`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `join_by_code(p_code text) returns uuid` (id del gruppo): normalizza (spazi, maiuscole, trattini); errori «Codice non valido» (vuoto, malformato, inesistente o gruppo concluso), «Codice non valido» anche in presenza di blocchi (non rivelare altro); rientro dopo `left` consentito; già membro → restituisce il gruppo senza errori.
  - `invite_to_group(p_group_id uuid, p_user_id uuid) returns void`: il chiamante è membro attivo; il destinatario è amico accettato del chiamante e senza blocchi con alcun membro attivo; crea/rinnova `group_members` con stato `invited` e `invited_by`; errori «Invito non possibile» (non amico, blocchi, già membro attivo).
  - `list_group_invites() returns table (group_id uuid, inviter_nickname text, ride_type text, destination text, created_at timestamptz)`: inviti `invited` ancora validi (gruppo non concluso).
  - `respond_group_invite(p_group_id uuid, p_accept boolean) returns void`: accettando diventa `active` (con controllo dei blocchi), rifiutando diventa `left`.

- [ ] **Step 1: Test.** Codice di un gruppo attivo: C lo usa → membro attivo e `my_group()` mostra quel gruppo; stesso codice scritto in minuscolo con spazi e trattino (`ab c-234` equivalente) funziona; codici `''`, `'abc'`, `'ABCDEF!'`, inesistente → «Codice non valido»; gruppo concluso → «Codice non valido»; utente bloccato da un membro → «Codice non valido» e nessuna riga in `group_members`; rientro dopo `left` ok; `invite_to_group` da membro a un amico → compare in `list_group_invites` dell'amico, non ai non amici (errore «Invito non possibile»); da non membro → errore; `respond_group_invite(true)` → membro attivo, `false` → `left`; un invito a un gruppo concluso non compare; anonimo → «permission denied».
- [ ] **Step 2:** Esegui: Expected: falliscono.
- [ ] **Step 3:** Scrivi `0009_inviti.sql`.
- [ ] **Step 4:** Esegui tutti i test SQL: Expected: tutti passati. Mutazione: togli il controllo dei blocchi in `join_by_code` e verifica il fallimento.
- [ ] **Step 5:** Applica al progetto, prova in transazione annullata, commit `feat: inviti con codice e inviti agli amici`.

### Task 5: Livello di accesso al server per gruppi, richieste, inviti

**Files:**
- Create: `src/groups/types.ts`, `src/api/groupsApi.ts`
- Modify: `src/api/index.ts` (aggiunge `getGroupsApi()`), `src/map/types.ts` (`Rider` ottiene `groupId: string | null` e `memberCount: number | null`), `src/api/ridersApi.ts` (mappa `group_id`, `member_count`; `startRide(id, s, groupId?)` passa `p_group_id`, e `p_ride_type` null se c'è il gruppo)
- Test: `src/api/groupsApi.test.ts`, `src/api/ridersApi.test.ts` (aggiornato)

**Interfaces:**
- Consumes: `RpcClient` (`friendsApi.ts`), funzioni dei Task 1–4.
- Produces: tipi in `src/groups/types.ts`: `MyGroup = { groupId: string; rideType: RideType; destination: string | null; inviteCode: string; role: 'owner' | 'member'; memberCount: number; rideId: string | null }`; `Participant = { id: string; nickname: string; avatar: string; gender: Gender; role: 'owner' | 'member'; riding: boolean }`; `IncomingRequest = { requestId: string; groupId: string; requesterId: string; nickname: string; avatar: string; gender: Gender; message: string | null; createdAt: number }`; `MyRequest = { requestId: string; groupId: string; status: 'pending' | 'accepted' | 'declined' | 'cancelled'; meet: { lat: number; lng: number } | null; meetNote: string | null; answeredAt: number | null; createdAt: number }`; `GroupInvite = { groupId: string; inviterNickname: string; rideType: RideType; destination: string | null; createdAt: number }`; `MeetPoint = { lat: number; lng: number } | null`.
  `createGroupsApi(client: RpcClient)` → `{ myGroup(): Promise<MyGroup | null>; participants(groupId: string): Promise<Participant[]>; requestJoin(groupId: string, message: string | null): Promise<string>; cancelRequest(requestId: string): Promise<void>; respond(requestId: string, accept: boolean, meet: MeetPoint, note: string | null): Promise<void>; incomingRequests(): Promise<IncomingRequest[]>; myRequests(): Promise<MyRequest[]>; joinByCode(code: string): Promise<string>; inviteFriend(groupId: string, userId: string): Promise<void>; groupInvites(): Promise<GroupInvite[]>; respondInvite(groupId: string, accept: boolean): Promise<void> }`. Errori del server → `Error` con lo stesso messaggio; tempi in millisecondi.

- [ ] **Step 1: Test.** Con client finto: ogni metodo chiama la funzione giusta con i nomi di parametro SQL esatti (`p_group_id`, `p_message`, `p_request_id`, `p_accept`, `p_meet_lat`, `p_meet_lng`, `p_note`, `p_code`, `p_user_id`); `respond` con `meet = null` manda lat/lng null; le righe sono convertite (snake_case → camelCase, ISO → ms, `meet` null se lat/lng null); `myGroup` con risposta vuota → `null`; errore del server rilanciato (es. «Richiesta già gestita»); `ridersApi.startRide(id, s, 'g1')` passa `p_group_id: 'g1'` e `p_ride_type: null`; `inArea` converte `group_id`/`member_count` (null mantenuti).
- [ ] **Step 2:** `npx jest groupsApi ridersApi`: Expected: falliscono.
- [ ] **Step 3:** Implementa i tipi, `groupsApi.ts`, le modifiche a `ridersApi.ts`/`types.ts`, `getGroupsApi()`.
- [ ] **Step 4:** `npx jest` e `npx tsc --noEmit`: Expected: passano (corregge i test esistenti di `Rider` aggiungendo i due campi).
- [ ] **Step 5:** Commit `feat: accesso al server per gruppi, richieste e inviti`.

### Task 6: Logica pura dei gruppi

**Files:**
- Create: `src/groups/inviteCode.ts`, `src/groups/inviteMessage.ts`, `src/groups/requestState.ts`, `src/groups/meetPoint.ts`
- Test: `src/groups/inviteCode.test.ts`, `inviteMessage.test.ts`, `requestState.test.ts`, `meetPoint.test.ts`

**Interfaces:**
- Consumes: tipi del Task 5; `whatsappUrl` da `src/friends/invite.ts` (leggilo per il nome e la firma esatti).
- Produces:
  - `normalizeInviteCode(input: string): string | null`: toglie spazi e trattini, maiuscole; `null` se non è di 6 caratteri dell'alfabeto ammesso.
  - `INVITE_BASE_URL = 'https://www.motoamiciapp.it/invito/'`; `buildGroupInviteMessage(a: { nickname: string; destination: string | null; code: string }): string` (italiano; contiene nickname, destinazione se c'è, il link con il codice e il codice scritto); `groupInviteWhatsappUrl(message: string): string`.
  - `requestStateFor(groupId: string, myGroupId: string | null, mine: MyRequest[], now: number): { kind: 'member' | 'can-request' | 'pending' | 'wait'; requestId?: string; waitMinutes?: number }` (`member` se `groupId === myGroupId`; `pending` se c'è una richiesta pending; `wait` se rifiutata da meno di un'ora, con i minuti mancanti arrotondati per eccesso).
  - `isMeetPointFresh(answeredAt: number | null, now: number): boolean` (≤ 24 ore).
  - `badgeCount(s: { incoming: IncomingRequest[]; invites: GroupInvite[]; answered: MyRequest[] }): number` (richieste in arrivo + inviti + risposte accettate o rifiutate non ancora viste: l'«ancora non viste» lo decide l'app con una lista di id passata in `answered`).

- [ ] **Step 1: Test** (nome → asserzione): `normalizeInviteCode('ab c-234')` → `'ABC234'`; `''`, `'abc'`, `'ABCDEF!'`, `'ABCDE0'` (0 non ammesso) → `null`; il messaggio contiene `'https://www.motoamiciapp.it/invito/ABC234'`, `'ABC234'` e, con destinazione `'Lago'`, `'Lago'`; senza destinazione non contiene `'null'`; l'URL WhatsApp codifica il testo; `requestStateFor`: stesso gruppo → `member`; nessuna richiesta → `can-request`; pending → `pending` con `requestId`; rifiutata 20 minuti fa → `wait` con `waitMinutes: 40`; rifiutata 61 minuti fa → `can-request`; annullata → `can-request`; `isMeetPointFresh`: 23 h → vero, 25 h → falso, null → falso; `badgeCount` somma le tre liste.
- [ ] **Step 2:** `npx jest src/groups`: Expected: falliscono.
- [ ] **Step 3:** Implementa i quattro moduli con le firme sopra.
- [ ] **Step 4:** `npx jest` e `npx tsc --noEmit`: Expected: passano.
- [ ] **Step 5:** Commit `feat: logica dei gruppi (codice, messaggio, stato richiesta, punto d'incontro)`.

### Task 7: Avvio del giro dentro il gruppo e stato dei gruppi dell'app

**Files:**
- Modify: `src/map/rideController.ts` (+ `rideController.test.ts`)
- Create: `src/groups/useGroupState.ts`, `src/groups/useGroupState.test.ts`

**Interfaces:**
- Consumes: Task 5, 6.
- Produces:
  - `rideController.start(s: RideSettings, groupId?: string)`: come ora, ma passa `groupId` a `api.startRide(id, s, groupId)` (la firma del `deps.api.startRide` diventa `(id: string, s: RideSettings, groupId?: string) => Promise<void>`); `defaultRide.ts` inoltra il terzo argomento a `getRidersApi().startRide`.
  - `createGroupState(deps: { fetchAll: () => Promise<GroupSnapshot>; onSnapshot: (s: GroupSnapshot) => void }): { refresh(): Promise<void>; dispose(): void }` con `GroupSnapshot = { group: MyGroup | null; incoming: IncomingRequest[]; mine: MyRequest[]; invites: GroupInvite[] }`; ignora le risposte superate (come `createRidersFeed`), dopo un errore non chiama `onSnapshot`, dopo `dispose` non chiama più nulla. `fetchAllGroupState(api): Promise<GroupSnapshot>` (le quattro chiamate in parallelo) in `useGroupState.ts`.

- [ ] **Step 1: Test.** `rideController`: `start(settings, 'g1')` chiama `startRide` con `'g1'`; senza gruppo il terzo argomento è `undefined`. `createGroupState`: due `refresh()` sovrapposti, il primo risponde per ultimo → `onSnapshot` riceve solo il secondo; errore → nessuna chiamata a `onSnapshot` e `refresh` non rilancia; dopo `dispose` nulla; `fetchAllGroupState` chiama le quattro API e compone lo snapshot.
- [ ] **Step 2:** `npx jest rideController useGroupState`: Expected: falliscono.
- [ ] **Step 3:** Implementa le modifiche e `useGroupState.ts`.
- [ ] **Step 4:** `npx jest` e `npx tsc --noEmit`: Expected: passano.
- [ ] **Step 5:** Commit `feat: giro dentro il gruppo e stato dei gruppi`.

### Task 8: Schermate dei gruppi e collegamento nella Mappa

**Files:**
- Create: `src/screens/map/GroupPanel.tsx`, `RequestsInbox.tsx`, `AcceptSheet.tsx`, `JoinByCode.tsx`
- Modify: `src/screens/map/RiderCard.tsx`, `TrackPanel.tsx`, `MapScreen.tsx`, `RidersMap.tsx` (nuova prop `onMapPress?: (lngLat: [number, number]) => void` e `meetPoint?: [number, number] | null` disegnato come cerchio su una seconda sorgente), `docs/field-test.md`

**Interfaces:**
- Consumes: Task 5–7; componenti `Button`, `Field`, `colors` da `src/screens/ui.tsx`, `Choice` da `profile/ProfileChoices.tsx`.
- Produces (comportamento che l'utente vede):
  - `RiderCard`: bottone «Chiedi di unirti» (con messaggio breve facoltativo) per chi tocca un motociclista con `groupId` che non è del proprio gruppo; stato «Richiesta inviata» con «Annulla», o «Potrai riprovare tra N minuti» (da `requestStateFor`); per i premium, elenco partecipanti caricato all'apertura con `groupsApi.participants`; per i free, solo nickname e la frase sul Premium già presente.
  - Il pannello del giro (`TrackPanel`) mostra, a giro in corso: `GroupPanel` con partecipanti, il **codice** e «Invita su WhatsApp» (usa `buildGroupInviteMessage`) e «Invita un amico dell'app» (elenco amici → `inviteFriend`); `RequestsInbox` con le richieste in arrivo e «Accetta» (apre `AcceptSheet`: «Nessun punto», «La mia posizione», «Scegli sulla mappa» che usa `onMapPress`, nota di 140 caratteri) e «Rifiuta».
  - Fuori dal giro, nella Mappa: pulsante «Ho un codice» (`JoinByCode`, usa `normalizeInviteCode` e mostra il messaggio del server), elenco inviti ricevuti con «Entra»/«Rifiuta», risposte alle mie richieste: accettata → «Parti con il gruppo» (avvia con `rideController.start({ rideType: <del gruppo>, visibility: 'all', destination: <del gruppo> }, groupId)` usando i dati di `myGroup()`), punto d'incontro disegnato sulla mappa e nota, se `isMeetPointFresh`; rifiutata → messaggio breve.
  - Aggiornamento ogni 10 s con `createRefreshLoop`, attivo solo con la scheda visibile e l'app aperta; un indicatore numerico (`badgeCount`) accanto al pulsante degli avvisi.

- [ ] **Step 1:** Implementa i componenti e i collegamenti sopra (nessun test unitario: componenti nativi; la logica è nei Task 6–7).
- [ ] **Step 2:** `npx tsc --noEmit` e `npx jest`: Expected: nessun errore, tutti i test passano.
- [ ] **Step 3:** Aggiungi a `docs/field-test.md` la sezione «Gruppi» con la prova a tre account (A e C sui due telefoni, B e D secondo i ruoli): A parte, mostra il codice; B (premium) tocca A, vede partecipanti, chiede di unirsi; A accetta con punto d'incontro, B vede il punto e preme «Parti con il gruppo»; C entra con il codice; blocco tra due membri; rifiuto e attesa di un'ora; un free chiede e un free risponde; il creatore esce e il ruolo passa; chiusura dell'ultimo giro: il codice non vale più; invito in app a un amico.
- [ ] **Step 4:** Lancia la build di sviluppo `eas build --platform android --profile development --non-interactive --no-wait` e annota il link. Commit `feat: gruppi, richieste e inviti nella mappa`.

---

## Autoverifica

- **Copertura della specifica:** modello gruppo (Task 1), regole di vedere/posizione esatta e premium (Task 2), richieste e prima risposta (Task 3), inviti codice/amici (Task 4), app: API (5), logica (6), flusso e stato (7), schermate (8). **Non in questo piano, per scelta:** notifiche push, tabella `notifications` (le funzioni di elenco coprono gli avvisi nell'app; il piano B aggiunge push come campanello sugli stessi eventi), pagina web `invito`, raggruppamento dei grandi gruppi.
- **Scostamenti dal progetto** (da ledgerare all'esecuzione): niente tabella `notifications` nel piano A; il messaggio libero resta fuori dall'app; la cancellazione a 24 ore è fatta con `start_ride` e filtro nell'app, non con un lavoro programmato.
- **Rischi noti:** il codice a 6 caratteri è indovinabile in teoria (limite alle richieste automatiche rimandato a prima della pubblicazione); il link `https` non apre ancora l'app finché non c'è la pagina del piano B, per questo il codice è sempre scritto nel messaggio.
