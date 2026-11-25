# Account, profilo, amici e blocchi — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrazione con email e password, profilo (nickname, sesso, avatar, moto, contatto fidato), ricerca amici con suggerimenti, richieste di amicizia e blocchi, con le regole di visibilità fatte rispettare dal server.

**Architecture:** App Expo esistente (il codice del prototipo GPS resta come base). Supabase Auth per email+password. Tabelle con accesso per riga e funzioni SQL per le operazioni con effetti collaterali (ricerca, richieste, blocco). Logica pura in moduli testati con Jest; chiamate al server dietro funzioni con client iniettato (testabili con un client finto).

**Tech Stack:** Expo + TypeScript, Supabase (Auth, Postgres), Jest, React Navigation.

**Spec:** `docs/superpowers/specs/2026-11-22-moto-app-design.md` (sezioni 3, 6 punto 2 e 10)

## Global Constraints

- Testi dell'interfaccia in italiano. Età minima 18 anni, con spunta obbligatoria alla registrazione.
- Password di almeno 8 caratteri. Nickname 3-20 caratteri, solo lettere, numeri, punto, trattino e trattino basso; unico senza distinguere le maiuscole.
- Ricerca amici: parte da 2 caratteri, al massimo 10 risultati, restituisce solo id, nickname, nome, avatar e sesso. Mai email, telefono o posizione.
- Il contatto fidato è visibile solo al proprietario.
- Blocco: invisibile nei due sensi (chi blocca e chi è bloccato non si vedono in ricerca, richieste ed elenchi); nessuna notifica al bloccato. Bloccare cancella l'amicizia e le richieste in sospeso.
- Le regole di visibilità stanno nel database (accesso per riga e funzioni), non solo nell'app.
- Nessuna chiave segreta nel repository. Il tracciamento GPS esistente non deve rompersi: i 73 test esistenti restano verdi.
- Conferma dell'email **spenta** durante lo sviluppo, da riaccendere prima della pubblicazione con un servizio di invio email.
- Avatar: catalogo fisso di emoji, nessun caricamento di foto.

## Review Focus

- **Blocchi nei due sensi:** il bloccato non trova chi lo ha bloccato in ricerca e viceversa; non può mandargli richieste.
- **Ricerca con caratteri speciali:** `%`, `_`, `\`, un solo carattere, spazi, testo vuoto non devono restituire l'intero elenco né dare errori.
- **Richieste doppie o incrociate:** a sé stessi, duplicata, e A→B mentre B→A è in sospeso (diventa amicizia).
- **Nickname:** «Mario» e «mario» sono lo stesso; registrazione con email già usata; doppio tocco sul tasto di registrazione.
- **Registrazione a metà:** utente creato ma profilo non salvato (app chiusa): alla riapertura riparte dal profilo, non resta bloccato.
- **Sessione scaduta durante il tracciamento:** i punti restano in coda e riprendono a partire dopo un nuovo accesso.
- **Numero di telefono del contatto fidato:** formati diversi (con +39, senza prefisso, con spazi) e numeri non validi.

---

## Struttura dei file

- `src/profile/validation.ts`, `src/profile/avatars.ts`, `src/profile/types.ts`
- `src/friends/relationship.ts`, `src/friends/search.ts`
- `src/api/authApi.ts`, `src/api/profilesApi.ts`, `src/api/friendsApi.ts`, `src/api/supabaseClient.ts` (client unico condiviso)
- `src/screens/auth/` (`LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`), `src/screens/profile/` (`ProfileEditScreen`, `AvatarPicker`), `src/screens/friends/` (`FriendsScreen`, `SearchBar`, `RequestsScreen`, `BlockedScreen`)
- `supabase/migrations/0002_account_amici.sql`, `supabase/tests/0002_rls.sql`, `docs/setup-supabase-account.md`

### Task 1: Accesso al progetto Supabase per le migrazioni

**Files:**
- Create: `docs/setup-supabase-account.md`

**Interfaces:**
- Produces: la possibilità di eseguire SQL e cambiare le impostazioni di Auth dal container senza incollare nulla nell'editor del telefono (l'editor mobile di Supabase rovina il testo incollato).

- [ ] **Step 1:** Scrivi `docs/setup-supabase-account.md`: **passi dell'utente** — in Supabase, Account → Access Tokens → «Generate new token»; dare il token alla sessione tramite il modulo sicuro per l'host `api.supabase.com` (credenziale con intestazione `Authorization: Bearer`). Revocarlo a fine lavoro.
- [ ] **Step 2:** Verifica: `curl -H "Authorization: Bearer proxy-injected" https://api.supabase.com/v1/projects` elenca il progetto `uqymtqlcotuhudshwszf`. Expected: risposta 200 con quel progetto.
- [ ] **Step 3:** Spegni la conferma email e l'accesso anonimo con `PATCH /v1/projects/uqymtqlcotuhudshwszf/config/auth` (`mailer_autoconfirm: true`, `external_anonymous_users_enabled: false`). Verifica rileggendo la configurazione.
- [ ] **Step 4:** Commit `docs: accesso al progetto Supabase per le migrazioni`.

### Task 2: Logica pura — validazione, avatar, relazioni, ricerca

**Files:**
- Create: `src/profile/types.ts`, `src/profile/validation.ts`, `src/profile/avatars.ts`, `src/friends/relationship.ts`, `src/friends/search.ts`
- Test: `src/profile/validation.test.ts`, `src/profile/avatars.test.ts`, `src/friends/relationship.test.ts`, `src/friends/search.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `BikeType = 'stradale-sportiva' | 'custom' | 'naked' | 'enduro' | 'maxienduro'`; `Gender = 'm' | 'f' | 'x'`; `Profile = { id: string; nickname: string; displayName: string | null; gender: Gender; avatar: string; bikeType: BikeType | null }`; `ProfileSummary = Pick<Profile, 'id' | 'nickname' | 'displayName' | 'avatar' | 'gender'>`; `Friendship = { requester: string; addressee: string; status: 'pending' | 'accepted' }`; `Block = { blocker: string; blocked: string }`.
  - `validation.ts`: `validateNickname(s: string): { ok: true; value: string } | { ok: false; error: string }` (messaggi in italiano); `validatePassword(s)`, `validateEmail(s)` con lo stesso schema; `validateRegistration(i: { email: string; password: string; nickname: string; isAdult: boolean; acceptedPrivacy: boolean }): { ok: boolean; errors: Partial<Record<'email' | 'password' | 'nickname' | 'isAdult' | 'acceptedPrivacy', string>> }`; `normalizePhone(s: string): { ok: true; value: string } | { ok: false; error: string }` (E.164: `3331234567` e `333 123 4567` diventano `+393331234567`; `+39…` resta; da 8 a 15 cifre).
  - `avatars.ts`: `AVATARS: { id: string; emoji: string; label: string }[]` (20 voci), `DEFAULT_AVATAR_ID`, `isValidAvatar(id: string): boolean`.
  - `relationship.ts`: `type Relationship = 'none' | 'friends' | 'request-sent' | 'request-received' | 'blocked-by-me'`; `relationshipWith(me: string, other: string, friendships: Friendship[], blocks: Block[]): Relationship`.
  - `search.ts`: `normalizeQuery(q: string): string | null` (toglie spazi ai lati, riduce gli spazi multipli, rimuove `% _ \`, restituisce `null` sotto i 2 caratteri); `debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void`.

- [ ] **Step 1:** Scrivi i test (nome → asserzione): nickname `ab` → troppo corto; 21 caratteri → troppo lungo; `mario rossi` e `mario@` → caratteri non ammessi; `Mario_88` → ok; password `1234567` → rifiutata, `12345678` → ok; `validateRegistration` senza `isAdult` → errore sul campo `isAdult`; `normalizePhone('333 123 4567')` → `+393331234567`, `'+39 333 123 4567'` → stesso, `'12'` → errore; 20 avatar con id unici, `isValidAvatar('inesistente')` → false; `relationshipWith` per ognuno dei 5 casi e `blocked-by-me` ha la precedenza su `friends`; `normalizeQuery(' ma ')` → `'ma'`, `'m'` → `null`, `'a%_b'` → `'ab'`, `''` → `null`; `debounce` con timer finti: tre chiamate in 100 ms → una sola esecuzione, con gli argomenti dell'ultima.
- [ ] **Step 2:** Esegui `npx jest profile friends`: fallisce (moduli assenti).
- [ ] **Step 3:** Implementa i cinque file con le firme sopra.
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: validazione, avatar, relazioni e ricerca`.

### Task 3: Database — tabelle, regole di accesso, funzioni

**Files:**
- Create: `supabase/migrations/0002_account_amici.sql`, `supabase/tests/0002_rls.sql`

**Interfaces:**
- Produces: tabelle `profiles(id uuid pk references auth.users, nickname text not null, display_name text, gender text check in ('m','f','x'), avatar text not null, bike_type text, created_at)` con indice unico su `lower(nickname)`; `emergency_contacts(user_id pk, name, phone)`; `friendships(requester, addressee, status check in ('pending','accepted'), created_at, pk (requester, addressee), check requester <> addressee)`; `blocks(blocker, blocked, pk)`. Accesso per riga: ognuno scrive solo il proprio profilo; ognuno legge il proprio contatto fidato e nessun altro; `friendships` visibile solo ai due coinvolti; `blocks` visibile solo a chi blocca. Funzioni `security definer`: `search_profiles(q text) returns setof profile_summary`, `send_friend_request(target uuid)`, `respond_friend_request(requester uuid, accept boolean)`, `remove_friend(target uuid)`, `block_user(target uuid)`, `unblock_user(target uuid)`, `list_friends()`, `list_requests()`, `list_blocked()`.
- Regole delle funzioni: `search_profiles` esclude se stessi e ogni persona legata da un blocco in uno dei due sensi, cerca per prefisso su nickname e nome (senza distinguere le maiuscole, con i caratteri speciali neutralizzati), minimo 2 caratteri, al massimo 10 righe. `send_friend_request` rifiuta se a sé stessi, se c'è un blocco in uno dei due sensi, se esiste già una richiesta o amicizia; se esiste la richiesta inversa in sospeso la accetta. `block_user` cancella l'amicizia e le richieste tra i due e inserisce il blocco.

- [ ] **Step 1:** Scrivi `supabase/tests/0002_rls.sql`: crea tre utenti finti (A, B, C) e verifica con `set role authenticated` e `request.jwt.claims`: A blocca B → la ricerca di B non trova A e viceversa; ricerca `%` e `_` restituiscono zero righe; richiesta A→B poi B→A → amicizia accettata; richiesta a sé stessi → errore; A non legge il contatto fidato di B; due nickname che differiscono per le maiuscole → violazione di unicità.
- [ ] **Step 2:** Prova prima l'SQL su un Postgres locale (installa `postgresql` nel container; crea ruoli e lo schema minimo `auth.users`/`auth.uid()` finto) e fai fallire i test: Expected: errori per tabelle assenti.
- [ ] **Step 3:** Scrivi `0002_account_amici.sql` con tabelle, accesso per riga e funzioni sopra.
- [ ] **Step 4:** Esegui di nuovo `0002_rls.sql` sul Postgres locale: tutte le verifiche passano.
- [ ] **Step 5:** Applica la migrazione al progetto con `POST /v1/projects/uqymtqlcotuhudshwszf/database/query` e rileggi `information_schema.tables`. Expected: le quattro tabelle esistono. Commit `feat: tabelle e regole per profili, amici e blocchi`.

### Task 4: Livello di accesso al server

**Files:**
- Create: `src/api/supabaseClient.ts`, `src/api/authApi.ts`, `src/api/profilesApi.ts`, `src/api/friendsApi.ts`
- Modify: `src/api/trackApi.ts` (usa il client condiviso; `ensureSignedIn` non fa più l'accesso anonimo: se non c'è sessione lancia un errore)
- Test: `src/api/authApi.test.ts`, `src/api/profilesApi.test.ts`, `src/api/friendsApi.test.ts`, `src/api/trackApi.test.ts` (aggiornato)

**Interfaces:**
- Consumes: i tipi del Task 2, le funzioni del Task 3.
- Produces: `createAuthApi(client)` → `{ signUp(email: string, password: string): Promise<void>; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void>; sendPasswordReset(email: string): Promise<void>; getSession(): Promise<boolean>; onSessionChange(cb: (loggedIn: boolean) => void): () => void }`; `createProfilesApi(client)` → `{ getMyProfile(): Promise<Profile | null>; saveProfile(p: Omit<Profile, 'id'>): Promise<void>; isNicknameAvailable(n: string): Promise<boolean>; getEmergencyContact(): Promise<{ name: string; phone: string } | null>; saveEmergencyContact(c: { name: string; phone: string }): Promise<void> }`; `createFriendsApi(client)` → `{ search(q: string): Promise<ProfileSummary[]>; sendRequest(id: string): Promise<void>; respond(id: string, accept: boolean): Promise<void>; remove(id: string): Promise<void>; block(id: string): Promise<void>; unblock(id: string): Promise<void>; list(): Promise<{ friends: ProfileSummary[]; received: ProfileSummary[]; sent: ProfileSummary[] }>; listBlocked(): Promise<ProfileSummary[]> }`. Gli errori del server diventano `Error` con messaggi in italiano («Email già registrata», «Nickname già in uso», «Credenziali non valide»).

- [ ] **Step 1:** Scrivi i test con un client finto: `signUp` con email già registrata → errore «Email già registrata»; `signIn` con credenziali sbagliate → «Credenziali non valide»; `isNicknameAvailable('Mario')` interroga senza distinguere le maiuscole; `search` passa a `search_profiles` il testo già normalizzato e con meno di 2 caratteri non chiama il server e restituisce `[]`; `sendRequest` e `block` chiamano le funzioni giuste; `ensureSignedIn` senza sessione lancia «Accedi per continuare» e non fa l'accesso anonimo.
- [ ] **Step 2:** Esegui `npx jest api`: fallisce.
- [ ] **Step 3:** Implementa le funzioni con le firme sopra, usando un unico client Supabase condiviso.
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano, compresi i test GPS esistenti.
- [ ] **Step 5:** Commit `feat: accesso al server per account, profili e amici`.

### Task 5: Accesso e registrazione nell'app

**Files:**
- Create: `src/screens/auth/LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx`, `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx` (fasi: caricamento → accesso → profilo da completare → procedura permessi → app), `src/screens/TrackScreen.tsx` (il tracciamento parte solo con una sessione)
- Test: `src/navigation/stage.test.ts`

**Interfaces:**
- Consumes: `authApi`, `profilesApi`, `validateRegistration`.
- Produces: `nextStage(s: { loggedIn: boolean; hasProfile: boolean; permissionsDone: boolean }): 'login' | 'profile' | 'permissions' | 'app'` in `src/navigation/stage.ts`.

- [ ] **Step 1:** Test su `nextStage`: non connesso → `login`; connesso senza profilo → `profile` (anche dopo una chiusura a metà della registrazione); connesso con profilo ma senza permessi → `permissions`; tutto fatto → `app`; senza sessione, `login` vince su tutto.
- [ ] **Step 2:** Esegui il test: fallisce. Implementa `stage.ts`.
- [ ] **Step 3:** Costruisci le tre schermate (email, password con occhio, nickname, spunte 18+ e informativa; errori sotto i campi; il tasto si disattiva durante l'invio per evitare il doppio tocco) e collega `App.tsx` a `nextStage`.
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: accesso, registrazione e recupero password`.

### Task 6: Profilo e contatto fidato

**Files:**
- Create: `src/screens/profile/ProfileEditScreen.tsx`, `src/screens/profile/AvatarPicker.tsx`
- Test: `src/profile/profileForm.test.ts`
- Create: `src/profile/profileForm.ts`

**Interfaces:**
- Produces: `validateProfileForm(f: { nickname: string; displayName: string; gender: Gender; avatar: string; bikeType: BikeType | null; contactName: string; contactPhone: string }): { ok: boolean; errors: Record<string, string>; value?: { profile: Omit<Profile, 'id'>; contact: { name: string; phone: string } | null } }` (il contatto è facoltativo ma, se uno dei due campi è compilato, servono entrambi; il telefono viene normalizzato).

- [ ] **Step 1:** Test: nome del contatto senza telefono → errore sul telefono; entrambi vuoti → `contact: null`; telefono `333 123 4567` → salvato come `+393331234567`; avatar inesistente → errore; sesso non scelto → `x` (non indicato).
- [ ] **Step 2:** Esegui il test: fallisce. Implementa `profileForm.ts`.
- [ ] **Step 3:** Costruisci la schermata di modifica con il selettore di avatar (griglia di emoji), sesso (uomo, donna, preferisco non dirlo), tipo di moto e contatto fidato, con la spiegazione «solo tu vedi questo numero».
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: profilo, avatar e contatto fidato`.

### Task 7: Amici, ricerca con suggerimenti e blocchi

**Files:**
- Create: `src/screens/friends/FriendsScreen.tsx`, `SearchBar.tsx`, `RequestsScreen.tsx`, `BlockedScreen.tsx`, `src/friends/useFriendSearch.ts`
- Test: `src/friends/useFriendSearch.test.ts`

**Interfaces:**
- Produces: `createFriendSearch(deps: { search: (q: string) => Promise<ProfileSummary[]>; onResults: (r: ProfileSummary[]) => void; onError: (m: string) => void; delayMs?: number /* default 300 */ }): { type(q: string): void; dispose(): void }`: aspetta `delayMs` dall'ultima lettera, non cerca sotto i 2 caratteri (svuota i suggerimenti), e ignora le risposte di ricerche superate da una più recente.

- [ ] **Step 1:** Test con timer finti: scrivere «m», «ma», «mar» in 100 ms → una sola ricerca con `mar`; `type('m')` svuota i suggerimenti senza chiamare il server; una risposta lenta per `ma` arrivata dopo quella per `mar` non sovrascrive i risultati; un errore di rete chiama `onError` e non lascia suggerimenti vecchi; dopo `dispose()` non arriva più nulla.
- [ ] **Step 2:** Esegui il test: fallisce. Implementa `useFriendSearch.ts`.
- [ ] **Step 3:** Costruisci le schermate: barra di ricerca con suggerimenti (avatar, nickname, nome, tasto «Aggiungi» o lo stato: «Richiesta inviata», «Amici»), elenco amici, richieste ricevute con «Accetta» e «Rifiuta», e blocchi con «Sblocca». Il blocco chiede conferma. Tasto «Invita su WhatsApp» che apre WhatsApp con il testo pronto e il link per scaricare l'app.
- [ ] **Step 4:** Esegui `npx jest` e `npx tsc --noEmit`: passano.
- [ ] **Step 5:** Commit `feat: amici, ricerca con suggerimenti e blocchi`.

### Task 8: Build e prova sul telefono

**Files:**
- Modify: `docs/field-test.md` (sezione «Account e amici»)

- [ ] **Step 1:** Esegui tutti i test e `npx tsc --noEmit`. Expected: tutto verde.
- [ ] **Step 2:** Lancia la build di sviluppo con `eas build` (coda gratuita: può durare 40 minuti).
- [ ] **Step 3:** Scrivi in `docs/field-test.md` la prova da fare con **due telefoni**: registrare due utenti, cercarsi per nickname, mandarsi richiesta e accettare, bloccare e verificare che sparisca dalla ricerca dell'altro, uscire e rientrare, recupero password.
- [ ] **Step 4:** Commit `docs: prova su due telefoni di account e amici`.

---

## Autoverifica

- **Copertura:** registrazione e accesso (Task 5), recupero password (Task 4-5), profilo con sesso, avatar, moto e contatto fidato (Task 6), ricerca con suggerimenti, richieste, amicizie e blocchi (Task 3, 7), regole nel database (Task 3), WhatsApp (Task 7). Il segnaposto sulla mappa è rimandato al pezzo sulla mappa; le chat, gli inviti diretti e i livelli free/premium sono fuori da questo piano.
- **Coerenza dei tipi:** `Profile`, `ProfileSummary`, `Friendship`, `Block`, `Relationship` hanno gli stessi nomi in tutti i task.
- **Rischi noti:** l'editor SQL del telefono rovina il testo incollato (per questo le migrazioni passano dall'accesso al progetto, Task 1); la conferma email è spenta fino alla pubblicazione.
